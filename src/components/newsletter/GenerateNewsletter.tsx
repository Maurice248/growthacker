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
    selectedService, setSelectedService,
    topic, setTopic,
    status, setStatus,
    newsletter, setNewsletter,
    rawFallback, setRawFallback,
    errorMessage, setErrorMessage,
    retryPrompt, setRetryPrompt,
    templateId, setTemplateId,
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
      const data = Array.isArray(raw) ? raw[0] : raw as NewsletterData;
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
      <SettingsRequiredAlert required={GENERATE_REQUIRED_SETTINGS} className="mb-4" />
      <div className="nl-grid nl-grid-2">

        {/* ---- Left: inputs ---- */}
        <div className="sticky top-24">
          <div className="section-card nl-panel-body flex flex-col gap-6">

            {/* Step 1 */}
            <div>
              <label className="nl-label">Step 1: Select Service</label>
              <div className="flex flex-col gap-2 mt-2">
                {services.map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => setSelectedService(service)}
                    className={`nl-service-btn ${selectedService === service ? "selected" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`nl-radio-dot ${selectedService === service ? "active" : "inactive"}`} />
                      {service}
                    </span>
                    {selectedService === service && (
                      <div className="nl-check-icon">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <label className="nl-label">Step 2: Define Topic</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. How AI tenant screening reduces rental risk for landlords..."
                className="nl-textarea mt-2"
              />
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !selectedService || !topic.trim()}
              className="nl-btn-primary"
            >
              {isLoading ? (
                <><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" /> CRAFTING...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> GENERATE NOW</>
              )}
            </button>
          </div>
        </div>

        {/* ---- Right: Output ---- */}
        <div className="nl-output-panel">

          {/* Output header */}
          <div className="nl-output-header">
            <div className="flex items-center gap-3">
              <div
                className="nl-status-dot"
                style={{
                  background: isLoading ? '#f59e0b' : (newsletter ? '#10b981' : '#d1d5db'),
                  boxShadow: newsletter ? '0 0 8px rgba(16,185,129,0.4)' : 'none'
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#374151' }}>
                AI Masterpiece
              </span>
            </div>
            {hasContent && (
              <button
                onClick={handleCopy}
                style={{
                  padding: '6px 14px',
                  borderRadius: '100px',
                  border: '1px solid #f1f5f9',
                  background: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                {copied ? "Copied!" : "Copy Raw"}
              </button>
            )}
          </div>

          {/* Output body */}
          <div className="nl-output-body">
            {!isLoading && !hasContent && !errorMessage && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 text-indigo-400">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 4v4h4" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-700 mb-2">Awaiting Input...</h3>
                <p className="text-gray-400 text-sm max-w-xs">Select your service and define the focus to begin generation.</p>
              </div>
            )}

            {isLoading && (
              <div className="h-full flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-10">
                  <div className="w-12 h-12 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-indigo-600 rounded-full animate-ping opacity-75" />
                  </div>
                </div>
                <p className="text-base font-black text-gray-800 tracking-widest animate-pulse">
                  {status === "regenerating" ? "OPTIMIZING..." : status === "proceeding" ? "FINALIZING..." : "SYNTHESIZING..."}
                </p>
                <div className="mt-4 flex gap-1.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="h-full flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-5 shadow-md">
                  <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-base font-black text-gray-900">Generation Interrupted</p>
                <p className="text-gray-400 mt-2 text-xs font-bold uppercase tracking-widest max-w-xs">{errorMessage}</p>
                <button
                  onClick={handleGenerate}
                  className="mt-6 px-8 py-3 bg-gray-900 text-white rounded-xl text-sm font-black tracking-wider hover:bg-black transition-all active:scale-95"
                >
                  RETRY GENERATION
                </button>
              </div>
            )}

            {hasContent && (
              <div className="animate-in fade-in zoom-in-95 duration-500">
                {newsletter && <EmailPreview data={newsletter} />}
                {rawFallback && (
                  <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">{rawFallback}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Proceeded success */}
          {status === "proceeded" && (
            <div className="nl-output-actions space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex items-start gap-5">
                <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shrink-0 shadow-md shadow-green-200">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-green-900">Transmission Complete</p>
                  <p className="text-xs font-bold text-green-700/60 mt-1 uppercase tracking-widest">Template saved natively</p>
                  {templateId && (
                    <div className="mt-4 bg-white border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Internal UUID</p>
                        <p className="text-xs font-mono font-bold text-gray-900 truncate">{templateId}</p>
                      </div>
                      <button onClick={() => navigator.clipboard.writeText(templateId)} className="shrink-0 p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={reset} className="w-full py-4 text-sm font-black text-indigo-600 bg-white border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-all">
                START NEW SESSION
              </button>
            </div>
          )}

          {/* Authorize / Revise */}
          {status === "success" && (
            <div className="nl-output-actions animate-in slide-in-from-bottom-4 duration-500">
              <div className="nl-action-row">
                <button onClick={handleProceed} className="nl-btn-send">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  AUTHORIZE & SEND
                </button>
                <button onClick={() => setStatus("rejected")} className="nl-btn-revise">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  REVISE CONTENT
                </button>
              </div>
            </div>
          )}

          {/* AI Refinement */}
          {status === "rejected" && (
            <div className="nl-output-actions space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900 uppercase tracking-wider">AI REFINEMENT</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Specify changes for next iteration</p>
                </div>
              </div>
              <textarea
                value={retryPrompt}
                onChange={(e) => setRetryPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. Make the tone more landlord-focused, emphasize rent protection..."
                className="nl-textarea"
              />
              <div className="nl-action-row">
                <button
                  onClick={handleRegenerate}
                  disabled={!retryPrompt.trim()}
                  className="nl-btn-primary"
                  style={{ background: retryPrompt.trim() ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' : undefined }}
                >
                  RE-GENERATE
                </button>
                <button onClick={() => setStatus("success")} className="nl-btn-ghost">
                  DISCARD
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
