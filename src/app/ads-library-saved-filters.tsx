"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Spinner } from "./components";
import {
  adsLibraryFiltersActive,
  type AdsLibraryFilterState,
} from "@/lib/ads-library/filter-state";
import type { AdsLibrarySavedFilterRecord } from "@/lib/ads-library/saved-filters-shared";

export type AdsLibrarySaveFiltersAction = {
  /** Update the active saved filter, or open the name modal if none is active. */
  save: () => void;
  /** Always open the name modal to create a new saved filter. */
  saveAsNew: () => void;
};

function filterSummaryLines(filters: AdsLibraryFilterState): string[] {
  const lines: string[] = [];
  if (filters.searchTerms.length) {
    lines.push(`Search: ${filters.searchTerms.join(", ")}`);
  }
  if (filters.statusActive || filters.statusInactive) {
    lines.push(
      `Status: ${[filters.statusActive && "Active", filters.statusInactive && "Inactive"]
        .filter(Boolean)
        .join(", ")}`
    );
  }
  if (filters.includeCountries.length || filters.excludeCountries.length) {
    const parts: string[] = [];
    if (filters.includeCountries.length) {
      parts.push(`+${filters.includeCountries.join(", ")}`);
    }
    if (filters.excludeCountries.length) {
      parts.push(`−${filters.excludeCountries.join(", ")}`);
    }
    lines.push(`Countries: ${parts.join(" · ")}`);
  }
  if (filters.includeLanguages.length || filters.excludeLanguages.length) {
    const parts: string[] = [];
    if (filters.includeLanguages.length) {
      parts.push(`+${filters.includeLanguages.join(", ")}`);
    }
    if (filters.excludeLanguages.length) {
      parts.push(`−${filters.excludeLanguages.join(", ")}`);
    }
    lines.push(`Languages: ${parts.join(" · ")}`);
  }
  if (filters.mediaTypes.length) {
    lines.push(`Media: ${filters.mediaTypes.join(", ")}`);
  }
  if (filters.createdPreset || filters.createdFrom || filters.createdTo) {
    lines.push(
      `Created: ${
        filters.createdPreset ||
        `${filters.createdFrom || "…"} – ${filters.createdTo || "…"}`
      }`
    );
  }
  if (filters.lastSeenPreset || filters.lastSeenFrom || filters.lastSeenTo) {
    lines.push(
      `Last seen: ${
        filters.lastSeenPreset ||
        `${filters.lastSeenFrom || "…"} – ${filters.lastSeenTo || "…"}`
      }`
    );
  }
  if (filters.daysRunningMin || filters.daysRunningMax) {
    lines.push(
      `Days running: ${filters.daysRunningMin || "0"} – ${filters.daysRunningMax || "∞"}`
    );
  }
  if (filters.copyMin || filters.copyMax) {
    lines.push(`Copy length: ${filters.copyMin || "0"} – ${filters.copyMax || "∞"}`);
  }
  if (filters.videoMin || filters.videoMax) {
    lines.push(`Video length: ${filters.videoMin || "0"} – ${filters.videoMax || "∞"}`);
  }
  if (filters.angle) {
    lines.push(`Angle: ${filters.angle.replace(/\//g, " / ").replace(/-/g, " ")}`);
  }
  if (filters.maxAds) {
    lines.push(`Number of ads: ${filters.maxAds}`);
  }
  return lines;
}

type SavedFiltersContextValue = {
  savedFilters: AdsLibrarySavedFilterRecord[];
  loading: boolean;
  disabled: boolean;
  activeId: string | null;
  expandedId: string | null;
  deletingId: string | null;
  listOpen: boolean;
  setListOpen: (open: boolean) => void;
  setExpandedId: (id: string | null) => void;
  fetchSaved: () => Promise<void>;
  handleApply: (item: AdsLibrarySavedFilterRecord) => void;
  handleDelete: (item: AdsLibrarySavedFilterRecord) => Promise<void>;
};

const SavedFiltersContext = createContext<SavedFiltersContextValue | null>(null);

function useSavedFiltersContext() {
  const ctx = useContext(SavedFiltersContext);
  if (!ctx) {
    throw new Error("AdsLibrarySavedFiltersDropdown must be used within AdsLibrarySavedFilters");
  }
  return ctx;
}

type AdsLibrarySavedFiltersProps = {
  filters: AdsLibraryFilterState;
  disabled?: boolean;
  onApply: (filters: AdsLibraryFilterState) => void;
  /** Lets the filter bar save / save-as-new (buttons live under Clear all). */
  saveActionRef?: React.MutableRefObject<AdsLibrarySaveFiltersAction | null>;
  children?: React.ReactNode;
};

export function AdsLibrarySavedFilters({
  filters,
  disabled = false,
  onApply,
  saveActionRef,
  children,
}: AdsLibrarySavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<AdsLibrarySavedFilterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listOpen, setListOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "err" } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const canSave = adsLibraryFiltersActive(filters) && !disabled;

  useEffect(() => {
    if (!adsLibraryFiltersActive(filters)) setActiveId(null);
  }, [filters]);

  const showToast = useCallback((message: string, tone: "ok" | "err" = "ok") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ads-library/saved-filters");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load saved filters");
      setSavedFilters(data.savedFilters || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load saved filters", "err");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchSaved();
  }, [fetchSaved]);

  const openSaveAsNewModal = useCallback(() => {
    if (!canSave) {
      showToast("Add a search term or filter before saving", "err");
      return;
    }
    setNameInput("");
    setNameOpen(true);
  }, [canSave, showToast]);

  const handleSaveActive = useCallback(async () => {
    if (!canSave) {
      showToast("Add a search term or filter before saving", "err");
      return;
    }
    if (!activeId) {
      openSaveAsNewModal();
      return;
    }
    const active = savedFilters.find((f) => f.id === activeId);
    setSaving(true);
    try {
      const res = await fetch(`/api/ads-library/saved-filters/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || data.duplicate) {
        showToast("These filters are already saved", "err");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to save filter");
      if (data.savedFilter) {
        setSavedFilters((prev) =>
          prev.map((f) => (f.id === data.savedFilter.id ? data.savedFilter : f))
        );
        showToast(`Updated “${data.savedFilter.label || active?.label || "filter"}”`);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save filter", "err");
    } finally {
      setSaving(false);
    }
  }, [activeId, canSave, filters, openSaveAsNewModal, savedFilters, showToast]);

  useEffect(() => {
    if (!saveActionRef) return;
    saveActionRef.current = { save: () => void handleSaveActive(), saveAsNew: openSaveAsNewModal };
    return () => {
      saveActionRef.current = null;
    };
  }, [handleSaveActive, openSaveAsNewModal, saveActionRef]);

  const handleConfirmSave = async () => {
    const label = nameInput.trim();
    if (!label) {
      showToast("Please enter a name for these filters", "err");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ads-library/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, filters }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 || data.duplicate) {
        showToast("These filters are already saved", "err");
        setNameOpen(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to save filters");
      if (data.savedFilter) {
        setSavedFilters((prev) => [data.savedFilter, ...prev]);
        setActiveId(data.savedFilter.id);
        showToast(`Saved filter “${label}”`);
      }
      setNameOpen(false);
      setNameInput("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save filters", "err");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = useCallback(
    (item: AdsLibrarySavedFilterRecord) => {
      onApply(item.filters);
      setActiveId(item.id);
      showToast(`Applied “${item.label}” — click Search to scrape`);
      setListOpen(false);
    },
    [onApply, showToast]
  );

  const handleDelete = useCallback(
    async (item: AdsLibrarySavedFilterRecord) => {
      if (!confirm(`Delete saved filters “${item.label}”? This cannot be undone.`)) return;
      setDeletingId(item.id);
      try {
        const res = await fetch(`/api/ads-library/saved-filters/${item.id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to delete");
        setSavedFilters((prev) => prev.filter((f) => f.id !== item.id));
        if (activeId === item.id) setActiveId(null);
        if (expandedId === item.id) setExpandedId(null);
        showToast(`Deleted “${item.label}”`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to delete", "err");
      } finally {
        setDeletingId(null);
      }
    },
    [activeId, expandedId, showToast]
  );

  const ctxValue: SavedFiltersContextValue = {
    savedFilters,
    loading,
    disabled,
    activeId,
    expandedId,
    deletingId,
    listOpen,
    setListOpen,
    setExpandedId,
    fetchSaved,
    handleApply,
    handleDelete,
  };

  return (
    <SavedFiltersContext.Provider value={ctxValue}>
      {children}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10001,
            padding: "10px 16px",
            borderRadius: 10,
            background: toast.tone === "err" ? "#991B1B" : "#003049",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
          }}
        >
          {toast.message}
        </div>
      )}

      {nameOpen && (
        <div
          onClick={() => !saving && setNameOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 18,
              width: "100%",
              maxWidth: 440,
              overflow: "hidden",
              boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ padding: "18px 22px", background: "linear-gradient(135deg, #003049, #1A4A66)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Save as new filter</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                Name this filter set — it will appear under Saved filters, like Brand & ICP templates.
              </div>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#8C8474",
                  marginBottom: 8,
                }}
              >
                Filter name
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. US immigration active ads…"
                value={nameInput}
                disabled={saving}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleConfirmSave();
                  if (e.key === "Escape") setNameOpen(false);
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  fontSize: 14,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #E8DCC2",
                  background: "#FDF6E3",
                  color: "#23394A",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setNameOpen(false)}
                  disabled={saving}
                  style={{
                    fontFamily: "inherit",
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "1px solid #E8DCC2",
                    background: "#fff",
                    color: "#8C8474",
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmSave()}
                  disabled={saving || !nameInput.trim()}
                  style={{
                    fontFamily: "inherit",
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: saving || !nameInput.trim() ? "#E8DCC2" : "#C1121F",
                    color: saving || !nameInput.trim() ? "#8C8474" : "#fff",
                    fontWeight: 700,
                    cursor: saving || !nameInput.trim() ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {saving && <Spinner size={14} color="#8C8474" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SavedFiltersContext.Provider>
  );
}

export function AdsLibrarySavedFiltersDropdown() {
  const {
    savedFilters,
    loading,
    disabled,
    activeId,
    expandedId,
    deletingId,
    listOpen,
    setListOpen,
    setExpandedId,
    fetchSaved,
    handleApply,
    handleDelete,
  } = useSavedFiltersContext();

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listOpen, setListOpen]);

  return (
    <div ref={rootRef} className="ads-library-saved-filters-dropdown">
      <button
        type="button"
        className="ads-library-saved-filters-trigger"
        aria-label={`Saved filters${loading ? "" : ` (${savedFilters.length})`}`}
        title={`Saved filters${loading ? "" : ` (${savedFilters.length})`}`}
        aria-expanded={listOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          const next = !listOpen;
          setListOpen(next);
          if (next) void fetchSaved();
        }}
      >
        <ChevronDown
          size={18}
          className={
            listOpen
              ? "ads-library-saved-filters-trigger-chevron is-open"
              : "ads-library-saved-filters-trigger-chevron"
          }
        />
      </button>

      {listOpen && (
        <div className="ads-library-saved-filters-panel" role="listbox" aria-label="Saved filters">
          <div className="ads-library-saved-filters-panel-header">
            <div className="ads-library-saved-filters-panel-title">Saved filters</div>
            <div className="ads-library-saved-filters-panel-sub">
              Apply a set, then click Search to scrape
            </div>
          </div>

          <div className="ads-library-saved-filters-panel-body">
            {loading ? (
              <div className="ads-library-saved-filters-empty">
                <Spinner size={20} color="#003049" />
                <div style={{ marginTop: 10, fontSize: 12 }}>Loading…</div>
              </div>
            ) : savedFilters.length === 0 ? (
              <div className="ads-library-saved-filters-empty">
                <div style={{ fontSize: 13, fontWeight: 700, color: "#4A5A64" }}>No saved filters yet</div>
                <div style={{ fontSize: 12, color: "#9FA8A3", marginTop: 6, lineHeight: 1.4 }}>
                  Set filters, then click Save filter or Save as new filter under Clear all.
                </div>
              </div>
            ) : (
              savedFilters.map((item) => {
                const isActive = activeId === item.id;
                const isExpanded = expandedId === item.id;
                const summary = filterSummaryLines(item.filters);
                const savedDate = item.createdAt
                  ? new Date(item.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                return (
                  <div
                    key={item.id}
                    className="ads-library-saved-filters-item"
                    data-active={isActive ? "true" : "false"}
                  >
                    <div className="ads-library-saved-filters-item-main">
                      <div className="ads-library-saved-filters-item-copy">
                        <div className="ads-library-saved-filters-item-label">{item.label}</div>
                        <div className="ads-library-saved-filters-item-meta">Saved {savedDate}</div>
                        {summary[0] && (
                          <div className="ads-library-saved-filters-item-summary">
                            {summary[0]}
                            {summary.length > 1 ? ` · +${summary.length - 1} more` : ""}
                          </div>
                        )}
                      </div>
                      <div className="ads-library-saved-filters-item-actions">
                        <button
                          type="button"
                          className="ads-library-saved-filters-item-apply"
                          data-active={isActive ? "true" : "false"}
                          onClick={() => handleApply(item)}
                          disabled={disabled}
                        >
                          {isActive ? "✓ Applied" : "Apply"}
                        </button>
                        <button
                          type="button"
                          className="ads-library-saved-filters-item-view"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {isExpanded ? "Hide" : "View"}
                        </button>
                        <button
                          type="button"
                          className="ads-library-saved-filters-item-delete"
                          onClick={() => void handleDelete(item)}
                          disabled={deletingId === item.id || disabled}
                          aria-label={`Delete ${item.label}`}
                        >
                          {deletingId === item.id ? (
                            <Spinner size={12} color="#C1121F" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="ads-library-saved-filters-item-details">
                        {summary.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#9FA8A3", fontStyle: "italic" }}>
                            No filter details
                          </div>
                        ) : (
                          summary.map((line) => (
                            <div key={line} className="ads-library-saved-filters-item-detail-line">
                              {line}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
