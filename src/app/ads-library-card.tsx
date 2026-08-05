"use client";

import React, { useCallback, useRef, useState } from "react";
import { ExternalLink, MoreHorizontal, Play } from "lucide-react";
import { Badge } from "./components";
import type { AdsLibraryCardSections } from "@/lib/ads-library/view-settings";
import {
  daysRunningFromDates,
  domainFromAd,
  extractVideoUrlFromRaw,
} from "@/lib/ads-library/view-ads";

export type AdsLibraryCardAd = {
  id: string;
  adId: string;
  pageName: string;
  pageUrl: string;
  adType: string;
  hook: string;
  headline: string;
  body: string;
  cta: string;
  score: number;
  strength: string;
  imageUrl: string;
  hasVideo: boolean;
  impressionsText: string | null;
  impressionsMin: number | null;
  impressionsMax: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

type AdsLibraryCardProps = {
  ad: AdsLibraryCardAd;
  sections: AdsLibraryCardSections;
  hoverPlay: boolean;
  sound: boolean;
  formatImpressions: (ad: AdsLibraryCardAd) => string;
  onSeeDetails: () => void;
};

function formatImpressionsDefault(ad: AdsLibraryCardAd): string {
  if (ad.impressionsText) return ad.impressionsText;
  if (ad.impressionsMin != null && ad.impressionsMax != null && ad.impressionsMin !== ad.impressionsMax) {
    return `${ad.impressionsMin.toLocaleString()} – ${ad.impressionsMax.toLocaleString()}`;
  }
  if (ad.impressionsMax != null) return ad.impressionsMax.toLocaleString();
  if (ad.impressionsMin != null) return ad.impressionsMin.toLocaleString();
  return "Unknown";
}

export function AdsLibraryCard({
  ad,
  sections,
  hoverPlay,
  sound,
  formatImpressions = formatImpressionsDefault,
  onSeeDetails,
}: AdsLibraryCardProps & { formatImpressions?: (ad: AdsLibraryCardAd) => string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [hovering, setHovering] = useState(false);

  const loadVideoIfNeeded = useCallback(async () => {
    if (videoSrc || !ad.hasVideo || videoLoading) return videoSrc;
    setVideoLoading(true);
    try {
      const res = await fetch(`/api/ads-library/${ad.id}`);
      const data = await res.json();
      if (res.ok) {
        const url = extractVideoUrlFromRaw(data.raw);
        if (url) {
          setVideoSrc(url);
          return url;
        }
      }
    } catch {
      /* ignore */
    } finally {
      setVideoLoading(false);
    }
    return "";
  }, [ad.hasVideo, ad.id, videoLoading, videoSrc]);

  React.useEffect(() => {
    if (!hovering || !hoverPlay || !ad.hasVideo || !videoSrc) return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = !sound;
    void el.play().catch(() => {});
  }, [hovering, hoverPlay, ad.hasVideo, videoSrc, sound]);

  const onMediaEnter = () => {
    setHovering(true);
    if (hoverPlay && ad.hasVideo) void loadVideoIfNeeded();
  };

  const onMediaLeave = () => {
    setHovering(false);
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  };

  const menuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const days = daysRunningFromDates(ad.firstSeenAt, ad.lastSeenAt);
  const domain = domainFromAd(ad.pageUrl, ad.cta);
  const copy = ad.hook || ad.headline || ad.body;

  return (
    <article className="ads-library-card">
      {sections.productBlock && (
        <div
          className="ads-library-card-media"
          onMouseEnter={onMediaEnter}
          onMouseLeave={onMediaLeave}
        >
          {hoverPlay && ad.hasVideo && videoSrc ? (
            <video
              ref={videoRef}
              className="ads-library-card-media-video"
              src={videoSrc}
              poster={ad.imageUrl || undefined}
              muted={!sound}
              loop
              playsInline
              preload="none"
            />
          ) : ad.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.imageUrl} alt="" referrerPolicy="no-referrer" className="ads-library-card-media-img" />
          ) : (
            <span className="ads-library-card-media-empty">No preview</span>
          )}
          {ad.hasVideo && (
            <span className="ads-library-card-video-badge">
              <Play size={12} fill="#fff" />
              Video
            </span>
          )}
        </div>
      )}

      <div className="ads-library-card-body">
        {(sections.advertiserCopy || sections.cardMenu) && (
          <div className="ads-library-card-head">
            {sections.advertiserCopy && (
              <div className="ads-library-card-page">{ad.pageName}</div>
            )}
            <div className="ads-library-card-head-actions">
              {sections.advertiserCopy && (
                <Badge text={ad.adType} color="#003049" bg="#E7F0F6" />
              )}
              {sections.cardMenu && (
                <div className="ads-library-card-menu-wrap" ref={menuRef}>
                  <button
                    type="button"
                    className="ads-library-card-menu-btn"
                    aria-label="Card actions"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {menuOpen && (
                    <div className="ads-library-card-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onSeeDetails(); }}>
                        See details
                      </button>
                      {ad.pageUrl && (
                        <a href={ad.pageUrl} target="_blank" rel="noopener noreferrer" role="menuitem">
                          <ExternalLink size={14} />
                          Open page
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {sections.advertiserCopy && copy && (
          <p className="ads-library-card-copy">{copy}</p>
        )}

        {sections.ukEuMetrics && (
          <div className="ads-library-card-metrics-row">
            <span className="ads-library-card-metrics-label">Reach</span>
            <span>{formatImpressions(ad)}</span>
          </div>
        )}

        {sections.adMetrics && (
          <div className="ads-library-card-metrics-grid">
            <span>Score {ad.score}</span>
            <span>{ad.strength}</span>
            {days != null && <span>{days}d running</span>}
          </div>
        )}

        {sections.productRevenue && (
          <div className="ads-library-card-revenue">Est. revenue: —</div>
        )}

        {sections.ctaRow && (domain || ad.cta) && (
          <div className="ads-library-card-cta-row">
            {domain && <span className="ads-library-card-domain">{domain}</span>}
            {ad.cta && <span className="ads-library-card-cta">{ad.cta}</span>}
          </div>
        )}

        <button type="button" className="ads-library-card-details-btn" onClick={onSeeDetails}>
          See details
        </button>
      </div>
    </article>
  );
}
