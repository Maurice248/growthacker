"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  GripHorizontal,
  MousePointer2,
  MousePointer2Off,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  ADS_PER_BRAND_OPTIONS,
  DEFAULT_ADS_LIBRARY_CARD_SECTIONS,
  type AdsLibraryCardSections,
  type AdsLibraryViewMode,
  type AdsLibraryViewSettings,
  type AdsPerBrand,
  VIEW_MODE_OPTIONS,
  loadAdsLibraryViewSettings,
  saveAdsLibraryViewSettings,
} from "@/lib/ads-library/view-settings";

const CARD_SECTION_META: {
  key: keyof AdsLibraryCardSections;
  label: string;
  description: string;
}[] = [
  { key: "ukEuMetrics", label: "UK / EU metrics", description: "Reach, spend, and engagement." },
  { key: "adMetrics", label: "Ad metrics", description: "Score, rank, active ads, and days running." },
  { key: "cardMenu", label: "Card menu (···)", description: "Actions." },
  {
    key: "productRevenue",
    label: "Product revenue",
    description: "Hidden by default — rough EU estimate.",
  },
  { key: "advertiserCopy", label: "Advertiser row & copy", description: "Page and ad text." },
  { key: "ctaRow", label: "CTA row", description: "Domain and button." },
  { key: "productBlock", label: "Product block", description: "Image, title, price." },
];

type AdsLibraryToolbarProps = {
  visible: boolean;
  settings: AdsLibraryViewSettings;
  onChange: (next: AdsLibraryViewSettings) => void;
};

export function useAdsLibraryViewSettings() {
  const [settings, setSettings] = useState<AdsLibraryViewSettings>(() => loadAdsLibraryViewSettings());

  const update = useCallback((patch: Partial<AdsLibraryViewSettings> | ((prev: AdsLibraryViewSettings) => AdsLibraryViewSettings)) => {
    setSettings((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      saveAdsLibraryViewSettings(next);
      return next;
    });
  }, []);

  const patchCard = useCallback(
    (patch: Partial<AdsLibraryCardSections>) => {
      update((prev) => ({ ...prev, card: { ...prev.card, ...patch } }));
    },
    [update]
  );

  return { settings, update, patchCard };
}

export function AdsLibraryToolbar({ visible, settings, onChange }: AdsLibraryToolbarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen && !modeOpen && !brandOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
        setModeOpen(false);
        setBrandOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [settingsOpen, modeOpen, brandOpen]);

  if (!visible) return null;

  const modeLabel = VIEW_MODE_OPTIONS.find((o) => o.value === settings.mode)?.label ?? "Mode: All";
  const brandLabel =
    ADS_PER_BRAND_OPTIONS.find((o) => o.value === settings.adsPerBrand)?.label ?? "∞ ads/brand";

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="ads-library-float-bar-wrap" ref={rootRef}>
      <div className="ads-library-float-bar" role="toolbar" aria-label="Ads library view controls">
        <div className="ads-library-float-bar-settings-wrap">
          <button
            type="button"
            className="ads-library-float-bar-icon-btn"
            aria-label="Ad card settings"
            aria-expanded={settingsOpen}
            onClick={() => {
              setSettingsOpen((v) => !v);
              setModeOpen(false);
              setBrandOpen(false);
            }}
          >
            <Settings size={18} />
          </button>
          {settingsOpen && (
            <div className="ads-library-float-settings-panel" role="dialog" aria-label="Ad card settings">
              <div className="ads-library-float-settings-heading">AD CARD</div>
              <div className="ads-library-float-settings-sub">Show or hide card sections.</div>
              <ul className="ads-library-float-settings-list">
                {CARD_SECTION_META.map(({ key, label, description }) => (
                  <li key={key}>
                    <label className="ads-library-float-settings-row">
                      <input
                        type="checkbox"
                        checked={settings.card[key]}
                        onChange={(e) =>
                          onChange({
                            ...settings,
                            card: { ...settings.card, [key]: e.target.checked },
                          })
                        }
                      />
                      <span className="ads-library-float-settings-row-text">
                        <span className="ads-library-float-settings-row-label">{label}</span>
                        <span className="ads-library-float-settings-row-desc">{description}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="ads-library-float-bar-dropdown-wrap">
          <button
            type="button"
            className="ads-library-float-bar-text-btn"
            aria-expanded={modeOpen}
            onClick={() => {
              setModeOpen((v) => !v);
              setSettingsOpen(false);
              setBrandOpen(false);
            }}
          >
            {modeLabel}
            <ChevronDown size={14} />
          </button>
          {modeOpen && (
            <div className="ads-library-float-menu" role="menu">
              {VIEW_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  className="ads-library-float-menu-item"
                  data-selected={settings.mode === opt.value ? "true" : "false"}
                  onClick={() => {
                    onChange({ ...settings, mode: opt.value as AdsLibraryViewMode });
                    setModeOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ads-library-float-bar-dropdown-wrap">
          <button
            type="button"
            className="ads-library-float-bar-text-btn"
            aria-expanded={brandOpen}
            onClick={() => {
              setBrandOpen((v) => !v);
              setSettingsOpen(false);
              setModeOpen(false);
            }}
          >
            <GripHorizontal size={16} aria-hidden />
            {brandLabel}
            <ChevronDown size={14} />
          </button>
          {brandOpen && (
            <div className="ads-library-float-menu" role="menu">
              {ADS_PER_BRAND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  className="ads-library-float-menu-item"
                  data-selected={settings.adsPerBrand === opt.value ? "true" : "false"}
                  onClick={() => {
                    onChange({ ...settings, adsPerBrand: opt.value as AdsPerBrand });
                    setBrandOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`ads-library-float-bar-toggle ${settings.hoverPlay ? "is-on" : ""}`}
          title="Auto-play video ads when you hover over them."
          onClick={() => onChange({ ...settings, hoverPlay: !settings.hoverPlay })}
        >
          {settings.hoverPlay ? (
            <MousePointer2 size={16} aria-hidden />
          ) : (
            <MousePointer2Off size={16} aria-hidden />
          )}
          <span>Hover play</span>
        </button>

        <button
          type="button"
          className={`ads-library-float-bar-toggle ${settings.sound ? "is-on" : ""}`}
          title="Toggle sound for auto-playing video ads."
          onClick={() => onChange({ ...settings, sound: !settings.sound })}
        >
          {settings.sound ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
          <span>Sound</span>
        </button>

        <button
          type="button"
          className="ads-library-float-bar-icon-btn"
          aria-label="Scroll to top"
          onClick={scrollTop}
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}

export { DEFAULT_ADS_LIBRARY_CARD_SECTIONS };
