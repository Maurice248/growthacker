"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Play } from "lucide-react";
import { Badge, EditorialPage, EditorialPageHeader, Spinner } from "./components";
import { ActorPayloadDetails } from "./ads-library-actor-details";
import {
  AdsLibraryFilterBar,
  EMPTY_ADS_LIBRARY_FILTERS,
  type AdsLibraryFilterState,
  buildAdsLibrarySearchParams,
} from "./ads-library-filters";

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

function extractPreviewFromRaw(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const ad = raw as Record<string, unknown>;
  const snapshot = (ad.snapshot || {}) as Record<string, unknown>;

  const fromImages = (images: Record<string, unknown>[]) => {
    for (const img of images) {
      const url = img.original_image_url || img.resized_image_url || img.url;
      if (typeof url === "string" && url.trim()) return url.trim();
    }
    return "";
  };

  const fromVideos = (videos: Record<string, unknown>[]) => {
    for (const vid of videos) {
      const url = vid.video_preview_image_url || vid.thumbnail || vid.url;
      if (typeof url === "string" && url.trim()) return url.trim();
    }
    return "";
  };

  return (
    fromImages((snapshot.images || []) as Record<string, unknown>[]) ||
    fromVideos((snapshot.videos || []) as Record<string, unknown>[]) ||
    fromImages((snapshot.cards || []) as Record<string, unknown>[])
  );
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

type AdsLibraryProps = {
  onOpenCompetitors?: () => void;
};

export default function AdsLibrary({ onOpenCompetitors }: AdsLibraryProps) {
  const [filters, setFilters] = useState<AdsLibraryFilterState>(EMPTY_ADS_LIBRARY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdsLibraryFilterState | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
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

  const canSearch = filters.q.trim().length > 0;

  const runSearch = useCallback(() => {
    const q = filters.q.trim();
    if (!q) return;
    setAppliedFilters({ ...filters, q });
    setHasSearched(true);
    setPage(1);
    setError("");
  }, [filters]);

  const fetchLibrary = useCallback(async () => {
    if (!appliedFilters) return;
    setLoading(true);
    setError("");
    try {
      const params = buildAdsLibrarySearchParams(appliedFilters, appliedFilters.q.trim(), page);

      const res = await fetch(`/api/ads-library?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load ads");

      setAds(data.ads || []);
      setTotal(data.total ?? 0);
      setPageSize(data.pageSize ?? 24);
      setFacets(
        data.facets || { adTypes: [], countries: [], languages: [], angles: [] }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ads");
      setAds([]);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    if (appliedFilters) fetchLibrary();
  }, [appliedFilters, page, fetchLibrary]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const resetFilters = () => {
    setFilters(EMPTY_ADS_LIBRARY_FILTERS);
    setAppliedFilters(null);
    setHasSearched(false);
    setPage(1);
    setAds([]);
    setTotal(0);
    setError("");
  };

  const patchFilters = (patch: Partial<AdsLibraryFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
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
        extractPreviewFromRaw(data.raw);
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

  const empty = hasSearched && !loading && ads.length === 0;
  const idle = !hasSearched && !loading;

  return (
    <EditorialPage wide>
      <EditorialPageHeader
        eyebrow="Meta Ads"
        title="Ads Library"
        subtitle="Competitor ads collected from your Competitor Ad Analysis runs."
      />

      <AdsLibraryFilterBar
        filters={filters}
        onChange={patchFilters}
        onReset={resetFilters}
        onSearch={runSearch}
        canSearch={canSearch}
        showActiveFilters={hasSearched}
        activeFilterSource={appliedFilters ?? filters}
        facetCountries={facets.countries}
        facetLanguages={facets.languages}
        facetAngles={facets.angles}
        facetAdTypes={facets.adTypes}
      />

      {idle && !error && (
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
            Search your ads library
          </div>
          <div style={{ fontSize: 13, color: "#8C8474", maxWidth: 480, margin: "0 auto" }}>
            Ads are hidden until you search. Enter one or more keywords (comma-separated), optionally set filters,
            then press Enter or click the search icon.
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 24, color: "#8C8474" }}>
          <Spinner size={20} />
          Loading ads…
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: 16, borderRadius: 12, background: "#FEE2E2", color: "#991B1B", marginBottom: 16 }}>
          {error}
          {error.includes("competitor_ads") && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Apply the SQL migration in <code>prisma/migrations/add_competitor_ads.sql</code> if the table is missing.
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
          <div style={{ fontSize: 15, fontWeight: 700, color: "#23394A", marginBottom: 8 }}>No matching ads</div>
          <div style={{ fontSize: 13, color: "#8C8474", maxWidth: 420, margin: "0 auto 20px" }}>
            Nothing in your library matched those keywords and filters. Try different search terms or clear some filters,
            then search again.
          </div>
        </div>
      )}

      {!loading && ads.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: "#9FA8A3", marginBottom: 12 }}>
            {total} ad{total === 1 ? "" : "s"}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {ads.map((ad) => (
              <article
                key={ad.id}
                style={{
                  background: "#fff",
                  border: "1px solid #E8DCC2",
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "16 / 10",
                    background: "#FDF0D5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {ad.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ad.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: "#9FA8A3" }}>No preview</span>
                  )}
                  {ad.hasVideo && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(0,48,73,0.85)",
                        color: "#fff",
                        borderRadius: 8,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Play size={12} fill="#fff" />
                      Video
                    </span>
                  )}
                </div>
                <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#23394A", lineHeight: 1.3 }}>{ad.pageName}</div>
                    <Badge text={ad.adType} color="#003049" bg="#E7F0F6" />
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#5C5346",
                      margin: 0,
                      flex: 1,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical" as const,
                    }}
                  >
                    {ad.hook || ad.headline || ad.body}
                  </p>
                  <div style={{ fontSize: 11, color: "#9FA8A3" }}>Impressions: {formatImpressions(ad)}</div>
                  <button
                    type="button"
                    onClick={() => openAdDetails(ad)}
                    style={{
                      marginTop: 4,
                      width: "100%",
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "9px 0",
                      borderRadius: 10,
                      border: "1px solid #E8DCC2",
                      background: "#FDF6E3",
                      color: "#003049",
                      cursor: "pointer",
                    }}
                  >
                    See details
                  </button>
                </div>
              </article>
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
    </EditorialPage>
  );
}
