"use client";

import { useState } from "react";
import { useNewsletterHistory, NewsletterHistoryItem } from "@/context/NewsletterHistoryContext";
import { EditorialPageHeader, EditorialTabBar } from "@/components/editorial/editorial-layout";
import EmailPreview from "./EmailPreview";
import "./newsletter.css";

const formatDate = (id: string) => {
  try {
    const timestamp = parseInt(id);
    if (isNaN(timestamp)) return "Recently";
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "Recently";
    return (
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "Recently";
  }
};

function StatusLabel({ status }: { status: NewsletterHistoryItem["status"] }) {
  if (status === "proceeded") {
    return <span className="text-[13px] text-[#38678A]">Sent</span>;
  }
  return <span className="text-[13px] text-[#8C8474]">Draft</span>;
}

function HistoryItem({ item, onRemove }: { item: NewsletterHistoryItem; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (item.templateId) {
      navigator.clipboard.writeText(item.templateId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="nl-history-item">
      <div className="nl-history-row">
        <div className="min-w-[160px] flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <h4 className="nl-history-topic truncate">{item.topic}</h4>
            <StatusLabel status={item.status} />
          </div>
          <div className="nl-history-meta">{item.service}</div>
        </div>

        <div className="min-w-[120px]">
          <div className="text-[13px] text-[#8C8474]">{formatDate(item.id)}</div>
        </div>

        <div className="nl-history-actions">
          {item.templateId && (
            <button type="button" onClick={handleCopy} className="nl-btn-view">
              {copied ? "Copied" : "Template ID"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`nl-btn-view ${expanded ? "open" : ""}`}
          >
            {expanded ? "Hide" : "View"}
          </button>
          <button type="button" onClick={onRemove} className="nl-btn-delete" title="Delete">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="nl-history-expanded">
          {item.newsletter ? (
            <EmailPreview data={item.newsletter} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#2B3A4A]">
              {item.rawFallback}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewsletterHistory() {
  const { history, removeEntry } = useNewsletterHistory();
  const [filter, setFilter] = useState<"all" | "drafts" | "sent">("all");

  const counts = {
    all: history.length,
    drafts: history.filter((h) => h.status === "generated").length,
    sent: history.filter((h) => h.status === "proceeded").length,
  };

  const filtered = history.filter((item) => {
    if (filter === "all") return true;
    if (filter === "drafts") return item.status === "generated";
    if (filter === "sent") return item.status === "proceeded";
    return false;
  });

  return (
    <div className="nl-root">
      <EditorialPageHeader
        eyebrow="Newsletter"
        title="Newsletter History"
        subtitle="All newsletters you have generated, with their status and preview."
        className="mb-9"
      />

      <EditorialTabBar
        className="mb-2"
        activeId={filter}
        onChange={(id) => setFilter(id as "all" | "drafts" | "sent")}
        tabs={[
          { id: "all", label: "All", count: counts.all },
          { id: "drafts", label: "Drafts", count: counts.drafts },
          { id: "sent", label: "Sent", count: counts.sent },
        ]}
      />

      {filtered.length === 0 ? (
        <div className="nl-output-empty border-b border-[#E8DCC2]">
          <div className="nl-output-empty-title">No records found</div>
          <div className="nl-output-empty-sub">
            Try adjusting your filters or generate a new newsletter.
          </div>
        </div>
      ) : (
        <div>
          {filtered.map((item) => (
            <HistoryItem key={item.id} item={item} onRemove={() => removeEntry(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
