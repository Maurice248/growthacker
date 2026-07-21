"use client";

import { useState } from "react";
import { useServices } from "@/context/ServicesContext";
import { useNewsletter, NewsletterData } from "@/context/NewsletterContext";
import { useNewsletterHistory } from "@/context/NewsletterHistoryContext";
import EmailPreview from "./EmailPreview";
import SettingsRequiredAlert, { GENERATE_REQUIRED_SETTINGS } from "./SettingsRequiredAlert";
import "./newsletter.css";

const SECTIONS: { key: keyof NewsletterData; label: string }[] = [
  { key: "subjectLine", label: "Subject Line" },
  { key: "preheader", label: "Preheader" },
  { key: "headerTitle", label: "Header Title" },
  { key: "intro", label: "Introduction" },
  { key: "mainStory", label: "Main Story" },
  { key: "keyInsights", label: "Key Insights" },
  { key: "industryUpdate", label: "Industry Update" },
  { key: "proTip", label: "Pro Tip" },
  { key: "callToAction", label: "Call to Action" },
  { key: "closing", label: "Closing" },
  { key: "footerNote", label: "Footer Note" },
];

function formatText(text: string) {
  return text.replace(/\\n/g, "\n").trim();
}

function parseResponse(raw: unknown): NewsletterData | null {
  const data = Array.isArray(raw) ? raw[0] : raw;
  if (!data || typeof data !== "object") return null;
  const hasStructuredFields = SECTIONS.some(({ key }) => key in (data as object));
  return hasStructuredFields ? (data as NewsletterData) : null;
}

export default function GenerateNewsletter() {
  const { services } = useServices();
  const {
    selectedService,
    setSelectedService,
    topic,
    setTopic,
    status,
    setStatus,
    newsletter,
    setNewsletter,
    rawFallback,
    setRawFallback,
    errorMessage,
    setErrorMessage,
    retryPrompt,
    setRetryPrompt,
    templateId,
    setTemplateId,
    reset,
  } = useNewsletter();

  const { addEntry } = useNewsletterHistory();
  const [copied, setCopied] = useState(false);

  const applyResponse = (raw: unknown) => {
    const structured = parseResponse(raw);
    if (structured) {
      setNewsletter(structured);
      setRawFallback("");
    } else {
      const data = Array.isArray(raw) ? raw[0] : (raw as NewsletterData);
      const fallback = data?.output || data?.content || data?.newsletter;
      setRawFallback(fallback ? formatText(fallback) : JSON.stringify(raw, null, 2));
      setNewsletter(null);
    }
  };

  const saveToHistory = (nl: NewsletterData | null, rb: string, tid: string, st: "generated" | "proceeded") => {
    addEntry({
      id: Date.now().toString(),
      service: selectedService,
      topic: topic.trim(),
      newsletter: nl,
      rawFallback: rb,
      templateId: tid,
      status: st,
    });
  };

  const handleGenerate = async () => {
    if (!selectedService || !topic.trim()) return;
    setStatus("loading");
    setNewsletter(null);
    setRawFallback("");
    setErrorMessage("");

    try {
      const res = await fetch("/api/newsletter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: selectedService, topic: topic.trim() }),
      });

      const raw = await res.json();
      if (!res.ok) throw new Error(raw.error || `Request failed: ${res.statusText}`);
      applyResponse(raw);
      const structured = parseResponse(raw);
      saveToHistory(structured, structured ? "" : JSON.stringify(raw, null, 2), "", "generated");
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const handleRegenerate = async () => {
    if (!retryPrompt.trim()) return;
    setStatus("regenerating");
    setErrorMessage("");

    try {
      const res = await fetch("/api/newsletter/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: selectedService,
          topic: topic.trim(),
          retryPrompt: retryPrompt.trim(),
          previousContent: newsletter,
        }),
      });

      const raw = await res.json();
      if (!res.ok) throw new Error(raw.error || `Regeneration failed: ${res.statusText}`);
      applyResponse(raw);
      setRetryPrompt("");
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Regeneration failed");
      setStatus("error");
    }
  };

  const handleProceed = async () => {
    setStatus("proceeding");
    setErrorMessage("");
    setTemplateId("");

    try {
      const res = await fetch("/api/newsletter/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newsletter, service: selectedService, topic: topic.trim() }),
      });

      const raw = await res.json();
      if (!res.ok) throw new Error(raw.error || `Failed to send: ${res.statusText}`);
      const tid: string = raw?.["template id"] || raw?.templateId || raw?.template_id || "";
      setTemplateId(tid);
      saveToHistory(newsletter, rawFallback, tid, "proceeded");
      setStatus("proceeded");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send newsletter");
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    const text = newsletter
      ? SECTIONS.filter(({ key }) => newsletter[key])
          .map(({ label, key }) => `[${label.toUpperCase()}]\n${formatText(newsletter[key]!)}`)
          .join("\n\n---\n\n")
      : rawFallback;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLoading = status === "loading" || status === "regenerating" || status === "proceeding";
  const hasContent = (status === "success" || status === "rejected") && (newsletter || rawFallback);

  return (
    <div className="nl-root">
      <SettingsRequiredAlert required={GENERATE_REQUIRED_SETTINGS} className="mb-6" />
      <div className="nl-grid nl-grid-2">
        <div>
          <h3 className="nl-section-title">1 · Select Service</h3>
          <div className="flex flex-col">
            {services.map((service) => (
              <label key={service} className="nl-service-radio">
                <input
                  type="radio"
                  name="newsletter-service"
                  checked={selectedService === service}
                  onChange={() => setSelectedService(service)}
                />
                {service}
              </label>
            ))}
          </div>

          <h3 className="nl-section-title mt-7">2 · Define Topic</h3>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. How AI tenant screening reduces rental risk for landlords…"
            className="nl-textarea"
            rows={3}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !selectedService || !topic.trim()}
            className="nl-btn-primary mt-5"
          >
            {isLoading ? "Generating…" : "Generate now →"}
          </button>
        </div>

        <div className="nl-output-panel">
          <div className="nl-output-header">
            <h3 className="nl-panel-title">AI Draft</h3>
            {hasContent && (
              <button
                type="button"
                onClick={handleCopy}
                className="text-[13px] font-bold text-[#4A5A64] hover:text-[var(--primary)]"
              >
                {copied ? "Copied!" : "Copy raw"}
              </button>
            )}
          </div>

          <div className="nl-output-body">
            {!isLoading && !hasContent && !errorMessage && (
              <div className="nl-output-empty">
                <div className="nl-output-empty-title">Awaiting input…</div>
                <div className="nl-output-empty-sub">
                  Select your service and define the focus to begin generation.
                </div>
              </div>
            )}

            {isLoading && (
              <div className="nl-output-empty">
                <div className="nl-output-empty-title">
                  {status === "regenerating"
                    ? "Optimizing…"
                    : status === "proceeding"
                      ? "Finalizing…"
                      : "Generating…"}
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="nl-output-empty">
                <div className="nl-output-empty-title">Generation failed</div>
                <div className="nl-output-empty-sub">{errorMessage}</div>
                <button type="button" onClick={handleGenerate} className="nl-btn-primary nl-btn-auto mt-4">
                  Retry
                </button>
              </div>
            )}

            {hasContent && (
              <div className="py-4">
                {newsletter && <EmailPreview data={newsletter} />}
                {rawFallback && (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#2B3A4A]">
                    {rawFallback}
                  </pre>
                )}
              </div>
            )}
          </div>

          {status === "proceeded" && (
            <div className="nl-output-actions space-y-4">
              <div className="border-t border-[#E8DCC2] pt-4">
                <p className="text-[15px] font-bold text-[var(--primary)]">Template saved</p>
                {templateId && (
                  <div className="mt-3 flex items-center justify-between gap-3 border-b border-[#E8DCC2] pb-3">
                    <code className="truncate font-mono text-xs text-[#4A5A64]">{templateId}</code>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(templateId)}
                      className="text-[13px] font-bold text-[#8C8474] hover:text-[var(--primary)]"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
              <button type="button" onClick={reset} className="nl-btn-ghost">
                Start new session
              </button>
            </div>
          )}

          {status === "success" && (
            <div className="nl-output-actions">
              <div className="nl-action-row">
                <button type="button" onClick={handleProceed} className="nl-btn-send">
                  Authorize & send
                </button>
                <button type="button" onClick={() => setStatus("rejected")} className="nl-btn-revise">
                  Revise content
                </button>
              </div>
            </div>
          )}

          {status === "rejected" && (
            <div className="nl-output-actions space-y-4">
              <p className="text-sm font-bold text-[var(--primary)]">AI refinement</p>
              <textarea
                value={retryPrompt}
                onChange={(e) => setRetryPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. Make the tone more landlord-focused, emphasize rent protection…"
                className="nl-textarea"
              />
              <div className="nl-action-row">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={!retryPrompt.trim()}
                  className="nl-btn-primary nl-btn-auto flex-1"
                >
                  Re-generate
                </button>
                <button type="button" onClick={() => setStatus("success")} className="nl-btn-revise">
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
