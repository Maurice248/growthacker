"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Play } from "lucide-react";
import { EditorialPage, EditorialPageHeader, Spinner } from "./components";
import { ActorPayloadDetails } from "./ads-library-actor-details";
import { AdsLibraryCard } from "./ads-library-card";
import { AdsLibraryToolbar, useAdsLibraryViewSettings } from "./ads-library-toolbar";
import { applyAdsLibraryViewPipeline } from "@/lib/ads-library/view-settings";
import {
  AdsLibraryFilterBar,
  EMPTY_ADS_LIBRARY_FILTERS,
  adsLibraryFiltersActive,
  type AdsLibraryFilterState,
  buildAdsLibrarySearchParams,
} from "./ads-library-filters";
import { extractPreviewImageFromRaw } from "@/lib/ads-library/view-ads";

type LibraryAd = {
  id: string;
  adId: string;
  pageName: string;
  pageUrl: string;
  adType: string;
  startDate: string;
  platforms: string;
  hook: string;
  headline: string;
  body: string;
  cta: string;
  caption: string;
  framework: string;
  angles: string[];
  hashtags: string[];
  keywords: string[];
  strength: string;
  score: number;
  imageUrl: string;
  hasVideo: boolean;
  impressionsText: string | null;
  impressionsMin: number | null;
  impressionsMax: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

type Facets = {
  adTypes: Array<{ value: string; count: number }>;
  countries: string[];
  languages: string[];
  angles: string[];
};

function formatAngle(angle: string) {
  return angle.replace(/\//g, " / ").replace(/-/g, " ");
}

function formatImpressions(ad: LibraryAd) {
  if (ad.impressionsText) return ad.impressionsText;
  if (ad.impressionsMin != null && ad.impressionsMax != null && ad.impressionsMin !== ad.impressionsMax) {
    return `${ad.impressionsMin.toLocaleString()} – ${ad.impressionsMax.toLocaleString()}`;
  }
  if (ad.impressionsMax != null) return ad.impressionsMax.toLocaleString();
  if (ad.impressionsMin != null) return ad.impressionsMin.toLocaleString();
  return "Unknown";
}

function AdDetailPreview({
  url,
  hasVideo,
  reserveSlot,
}: {
  url: string;
  hasVideo?: boolean;
  reserveSlot?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!url && !reserveSlot) return null;

  return (
    <div
      style={{
        marginBottom: 16,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #E8DCC2",
        background: "#FDF0D5",
        position: "relative",
        minHeight: url || reserveSlot ? 200 : undefined,
      }}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Ad creative preview"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            display: "block",
            maxHeight: 360,
            objectFit: "contain",
            background: "#FDF0D5",
          }}
        />
      ) : url && failed ? (
        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#8C8474" }}>
          Preview could not be loaded in-app.{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#669BBC" }}>
            Open image in new tab
          </a>
        </div>
      ) : reserveSlot ? (
        <div
          style={{
            minHeight: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9FA8A3",
            fontSize: 12,
          }}
        >
          Loading preview…
        </div>
      ) : null}
      {hasVideo && url && !failed && (
        <span
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            background: "rgba(0,48,73,0.85)",
            color: "#fff",
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Play size={12} fill="#fff" />
          Video ad
        </span>
      )}
    </div>
  );
}

export default function AdsLibrary() {
  const [filters, setFilters] = useState<AdsLibraryFilterState>(EMPTY_ADS_LIBRARY_FILTERS);
  const { settings: viewSettings, update: setViewSettings } = useAdsLibraryViewSettings();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ads, setAds] = useState<LibraryAd[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [facets, setFacets] = useState<Facets>({
    adTypes: [],
    countries: [],
    languages: [],
    angles: [],
  });
  const [selected, setSelected] = useState<LibraryAd | null>(null);
  const [actorPayload, setActorPayload] = useState<unknown>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [scrapeActorLabel, setScrapeActorLabel] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  const filtersActive = adsLibraryFiltersActive(filters);

  const fetchKey = buildAdsLibrarySearchParams(filters, page).toString();

  const fetchLibrary = useCallback(async (signal?: AbortSignal): Promise<"running" | "done" | "error"> => {
      if (!adsLibraryFiltersActive(filters)) {
        setAds([]);
        setTotal(0);
        setLoading(false);
        return "done";
      }
      setLoading(true);
      setError("");
      try {
        const params = buildAdsLibrarySearchParams(filters, page);

        const res = await fetch(`/api/ads-library?${params.toString()}`, { signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load ads");

        if (data.status === "running") {
          setAds([]);
          setTotal(0);
          setFacets(data.facets || { adTypes: [], countries: [], languages: [], angles: [] });
          return "running";
        }

        setAds(data.ads || []);
        setTotal(data.total ?? 0);
        setPageSize(data.pageSize ?? 24);
        setFacets(
          data.facets || { adTypes: [], countries: [], languages: [], angles: [] }
        );
        setLoading(false);
        return "done";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "error";
        setError(e instanceof Error ? e.message : "Failed to load ads");
        setAds([]);
        setLoading(false);
        return "error";
      }
    },
    [filters, page]
  );

  useEffect(() => {
    const controller = new AbortController();
    let pollTimer: number | undefined;
    let cancelled = false;

    const run = async () => {
      const outcome = await fetchLibrary(controller.signal);
      if (cancelled || controller.signal.aborted) return;
      if (outcome === "running") {
        setLoading(true);
        pollTimer = window.setTimeout(run, 3000);
      }
    };

    const debounce = window.setTimeout(() => {
      void run();
    }, 400);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(debounce);
      if (pollTimer != null) window.clearTimeout(pollTimer);
    };
  }, [fetchKey, fetchLibrary]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const resetFilters = () => {
    setFilters(EMPTY_ADS_LIBRARY_FILTERS);
    setAds([]);
    setTotal(0);
    setError("");
    setPage(1);
  };

  const patchFilters = (patch: Partial<AdsLibraryFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch);
    const draftOnly = keys.length === 1 && keys[0] === "q";
    if (!draftOnly) setPage(1);
  };

  const openAdDetails = useCallback(async (ad: LibraryAd) => {
    const initialPreview = ad.imageUrl?.trim() || "";
    setPreviewImageUrl(initialPreview);
    setSelected(ad);
    setActorPayload(null);
    setDetailError("");
    setScrapeActorLabel("");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/ads-library/${ad.id}/scrape`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to scrape ad details");

      setActorPayload(data.raw ?? null);
      if (typeof data.actorLabel === "string") setScrapeActorLabel(data.actorLabel);
      const fromScrape =
        (typeof data.imageUrl === "string" ? data.imageUrl.trim() : "") ||
        extractPreviewImageFromRaw(data.raw);
      if (fromScrape) setPreviewImageUrl(fromScrape);
      else if (!initialPreview) {
        setPreviewImageUrl("");
      }
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Failed to scrape ad details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeAdDetails = () => {
    setSelected(null);
    setPreviewImageUrl("");
    setActorPayload(null);
    setDetailError("");
    setDetailLoading(false);
    setScrapeActorLabel("");
  };

  const detailRow = (label: string, value: React.ReactNode) =>
    value ? (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9FA8A3", marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: "#23394A", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value}</div>
      </div>
    ) : null;

  const displayAds = useMemo(
    () => applyAdsLibraryViewPipeline(ads, viewSettings),
    [ads, viewSettings]
  );

  const empty = filtersActive && !loading && displayAds.length === 0;
  const showInitialPrompt = !filtersActive && !loading;
  const showToolbar = !loading && filtersActive;

  return (
    <EditorialPage wide>
      <EditorialPageHeader
        eyebrow="Meta Ads"
        title="Ads Library"
        subtitle="Search the Meta Ads Library live — results are fetched from facebook.com/ads/library."
      />

      <AdsLibraryFilterBar
        filters={filters}
        onChange={patchFilters}
        onReset={resetFilters}
        facetCountries={facets.countries}
        facetLanguages={facets.languages}
        facetAngles={facets.angles}
        facetAdTypes={facets.adTypes}
      />

      {showInitialPrompt && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 24px",
            background: "#fff",
            border: "1px solid #E8DCC2",
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "#23394A", marginBottom: 8 }}>
            Filter your ads library
          </div>
          <div style={{ fontSize: 13, color: "#8C8474", maxWidth: 480, margin: "0 auto" }}>
            Add search terms (comma to create tags) or choose at least one filter below. We search Meta’s
            Ads Library and show matches here when the scrape finishes.
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 24, color: "#8C8474" }}>
          <Spinner size={20} />
          Fetching ads from Meta Ads Library…
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: 16, borderRadius: 12, background: "#FEE2E2", color: "#991B1B", marginBottom: 16 }}>
          {error}
          {error.includes("ad_library") && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Apply the SQL migration in <code>prisma/migrations/add_ad_library_tables.sql</code> if tables are
              missing.
            </div>
          )}
        </div>
      )}

      {empty && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "#fff",
            border: "1px solid #E8DCC2",
            borderRadius: 20,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "#23394A", marginBottom: 8 }}>
            No ads match this search
          </div>
          <div style={{ fontSize: 13, color: "#8C8474", maxWidth: 420, margin: "0 auto" }}>
            Try changing filters or add a search term for narrower results. A single filter (e.g. Active) loads
            up to your &quot;Number of ads&quot; limit from Meta&apos;s library.
          </div>
        </div>
      )}

      {!loading && filtersActive && displayAds.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: "#9FA8A3", marginBottom: 12 }}>
            {displayAds.length} ad{displayAds.length === 1 ? "" : "s"}
            {displayAds.length !== ads.length && (
              <span style={{ color: "#C4B89A" }}> (of {total} matching filters)</span>
            )}
          </div>
          <div className="ads-library-card-grid">
            {displayAds.map((ad) => (
              <AdsLibraryCard
                key={ad.id}
                ad={ad}
                sections={viewSettings.card}
                hoverPlay={viewSettings.hoverPlay}
                sound={viewSettings.sound}
                formatImpressions={formatImpressions}
                onSeeDetails={() => openAdDetails(ad)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 28 }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  fontFamily: "inherit",
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid #E8DCC2",
                  background: page <= 1 ? "#f5f5f5" : "#fff",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: 13, color: "#8C8474" }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  fontFamily: "inherit",
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid #E8DCC2",
                  background: page >= totalPages ? "#f5f5f5" : "#fff",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <Dialog.Root open={!!selected} onOpenChange={(open) => !open && closeAdDetails()}>
        <Dialog.Portal>
          <Dialog.Overlay className="sd-modal-overlay" />
          <Dialog.Content
            className="sd-modal-content ads-library-detail-modal"
            style={{
              maxWidth: 820,
              width: "92%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 0,
            }}
          >
            {selected && (
              <>
                <div className="sd-modal-header">
                  <div className="sd-modal-title-row">
                    <div>
                      <Dialog.Title className="sd-modal-title">{selected.pageName}</Dialog.Title>
                      <Dialog.Description className="sd-modal-desc">
                        {selected.adType} ad · {formatImpressions(selected)} impressions · ID {selected.adId}
                      </Dialog.Description>
                    </div>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" className="sd-modal-close-btn" aria-label="Close">
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                </div>

                <div style={{ padding: "0 28px 28px" }}>
                  <AdDetailPreview
                    key={previewImageUrl || selected.id}
                    url={previewImageUrl}
                    hasVideo={selected.hasVideo}
                    reserveSlot={
                      !previewImageUrl &&
                      (selected.adType === "image" ||
                        selected.adType === "video" ||
                        selected.adType === "carousel")
                    }
                  />

                  <div
                    style={{
                      fontSize: 11.5,
                      letterSpacing: "1.4px",
                      textTransform: "uppercase",
                      color: "#C1121F",
                      fontWeight: 700,
                      marginBottom: 12,
                    }}
                  >
                    Live Apify scrape{scrapeActorLabel ? ` · ${scrapeActorLabel}` : ""}
                  </div>

                  {detailLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", color: "#8C8474" }}>
                      <Spinner size={18} />
                      Scraping this ad from Meta Ads Library…
                    </div>
                  )}

                  {detailError && !detailLoading && (
                    <div style={{ padding: 12, borderRadius: 10, background: "#FEE2E2", color: "#991B1B", marginBottom: 12 }}>
                      {detailError}
                    </div>
                  )}

                  {!detailLoading && !detailError && (
                    <div
                      style={{
                        padding: "16px 18px",
                        background: "#FFFBF5",
                        border: "1px solid #E8DCC2",
                        borderRadius: 12,
                        marginBottom: 20,
                      }}
                    >
                      <ActorPayloadDetails payload={actorPayload} />
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 11.5,
                      letterSpacing: "1.4px",
                      textTransform: "uppercase",
                      color: "#669BBC",
                      fontWeight: 700,
                      marginBottom: 12,
                    }}
                  >
                    App enrichments (analysis run)
                  </div>
                  {detailRow("Search keywords", selected.keywords?.length ? selected.keywords.join(", ") : null)}
                  {detailRow("Framework", selected.framework)}
                  {detailRow(
                    "Angles",
                    selected.angles?.length ? selected.angles.map(formatAngle).join(", ") : null
                  )}
                  {detailRow("Score / strength", `${selected.score} (${selected.strength})`)}
                  {detailRow("First seen", new Date(selected.firstSeenAt).toLocaleString())}
                  {detailRow("Last seen", new Date(selected.lastSeenAt).toLocaleString())}
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AdsLibraryToolbar visible={showToolbar} settings={viewSettings} onChange={(next) => setViewSettings(next)} />
    </EditorialPage>
  );
}
