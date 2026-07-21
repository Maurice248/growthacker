"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search, Volume2, VolumeX, Check, Sparkles, Mic2, User, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import { Spinner } from './components';

interface Voice {
  voice_id: string;
  name: string;
  gender: string;
  accent: string;
  language: string;
  description: string;
  preview_url: string;
}

interface VoiceExplorerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVoice: (voiceId: string, voiceLabel: string) => void;
  selectedVoiceId: string;
}

const VOICES_PER_PAGE = 20;

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabic", bg: "Bulgarian", cs: "Czech", da: "Danish", de: "German",
  el: "Greek", en: "English", es: "Spanish", fi: "Finnish", fil: "Filipino",
  fr: "French", he: "Hebrew", hi: "Hindi", hr: "Croatian", hu: "Hungarian",
  id: "Indonesian", it: "Italian", ja: "Japanese", ko: "Korean", ms: "Malay",
  nl: "Dutch", no: "Norwegian", pl: "Polish", pt: "Portuguese", ro: "Romanian",
  ru: "Russian", sk: "Slovak", sv: "Swedish", ta: "Tamil", tr: "Turkish",
  uk: "Ukrainian", vi: "Vietnamese", zh: "Chinese",
};

// These always appear at the top, regardless of what the API returns
const PINNED_LANGUAGES = [
  { code: "en",      label: "English" },
  { code: "es",      label: "Spanish" },
  { code: "fr",      label: "French" },
  { code: "he",      label: "Hebrew" },
  { code: "tr",      label: "Turkish" },
];

// Alternate codes/names ElevenLabs may use for the same language
const LANGUAGE_ALIASES: Record<string, string> = {
  english: "en", spanish: "es", french: "fr",
  hebrew: "he", iw: "he", turkish: "tr",
  german: "de", arabic: "ar", chinese: "zh",
};

function getLanguageLabel(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] || code;
}

function normaliseLang(raw: string): string {
  const lower = raw.toLowerCase();
  return LANGUAGE_ALIASES[lower] || lower;
}

function sortLanguages(langs: string[]): string[] {
  const pinnedCodes = new Set(PINNED_LANGUAGES.map(p => p.code));
  const rest = langs
    .filter(l => !pinnedCodes.has(normaliseLang(l)))
    .sort((a, b) => getLanguageLabel(a).localeCompare(getLanguageLabel(b)));
  return rest;
}

export default function VoiceExplorerModal({
  isOpen,
  onOpenChange,
  onSelectVoice,
  selectedVoiceId
}: VoiceExplorerModalProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [accentFilter, setAccentFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Audio preview state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Fetch voices on open
  useEffect(() => {
    if (isOpen) {
      const fetchVoices = async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/elevenlabs/voices');
          const data = await res.json();
          if (data && data.voices) {
            setVoices(data.voices);
          }
        } catch (err) {
          console.error("Failed to load voices:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchVoices();
    } else {
      stopAudio();
    }
  }, [isOpen]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, genderFilter, accentFilter, languageFilter]);

  // Audio helpers
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVoiceId(null);
  };

  const playPreview = (voiceId: string, previewUrl: string) => {
    if (!previewUrl) return;
    if (playingVoiceId === voiceId) { stopAudio(); return; }
    stopAudio();
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    setPlayingVoiceId(voiceId);
    audio.play().catch(() => setPlayingVoiceId(null));
    audio.onended = () => { setPlayingVoiceId(null); audioRef.current = null; };
  };

  useEffect(() => { return () => stopAudio(); }, []);

  // Filter logic
  const filteredVoices = voices.filter(voice => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      voice.name.toLowerCase().includes(query) ||
      voice.accent.toLowerCase().includes(query) ||
      voice.language.toLowerCase().includes(query) ||
      voice.description.toLowerCase().includes(query);
    const matchesGender = genderFilter === 'all' || voice.gender === genderFilter;
    const matchesAccent = accentFilter === 'all' || voice.accent.toLowerCase().includes(accentFilter.toLowerCase());
    const matchesLanguage = languageFilter === 'all' || normaliseLang(voice.language) === languageFilter || voice.language.toLowerCase().includes(languageFilter.toLowerCase());
    return matchesSearch && matchesGender && matchesAccent && matchesLanguage;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredVoices.length / VOICES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * VOICES_PER_PAGE;
  const pageVoices = filteredVoices.slice(pageStart, pageStart + VOICES_PER_PAGE);

  const goToPage = (p: number) => {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)));
    gridRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Unique filter options derived from all voices
  const uniqueAccents = Array.from(new Set(voices.map(v => v.accent).filter(Boolean))).sort();
  const uniqueLanguages = sortLanguages(Array.from(new Set(voices.map(v => v.language).filter(Boolean))));

  const clearFilters = () => {
    setSearchQuery('');
    setGenderFilter('all');
    setAccentFilter('all');
    setLanguageFilter('all');
  };

  const hasActiveFilters = searchQuery || genderFilter !== 'all' || accentFilter !== 'all' || languageFilter !== 'all';

  // Pagination button helper
  const PaginationBtn = ({ page, active }: { page: number; active: boolean }) => (
    <button
      onClick={() => goToPage(page)}
      style={{
        minWidth: '30px',
        height: '30px',
        padding: '0 6px',
        borderRadius: '6px',
        border: active ? 'none' : '1px solid #E8DCC2',
        background: active ? '#003049' : '#ffffff',
        color: active ? '#ffffff' : '#4A5A64',
        fontSize: '12px',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {page}
    </button>
  );

  // Build visible page numbers
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sd-modal-overlay" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15, 23, 42, 0.4)' }} />

        <Dialog.Content
          className="sd-modal-content"
          style={{
            width: '95vw',
            maxWidth: '960px',
            minWidth: 0,
            height: '90vh',
            maxHeight: '820px',
            display: 'flex',
            flexDirection: 'column',
            padding: 'clamp(12px, 3vw, 24px)',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.25)',
            border: '1px solid #C2B79A',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #E8DCC2', paddingBottom: '14px' }}>
            <div style={{ textAlign: 'left' }}>
              <Dialog.Title style={{ fontSize: '20px', fontWeight: 800, color: '#003049', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Sparkles size={20} color="#003049" />
                ElevenLabs Voice Explorer
              </Dialog.Title>
              <Dialog.Description style={{ fontSize: '12px', color: '#8C8474', marginTop: '4px', margin: 0 }}>
                {loading ? 'Loading voice library…' : `${filteredVoices.length.toLocaleString()} voices found · Page ${safePage} of ${totalPages}`}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                onClick={stopAudio}
                style={{ background: '#FDF0D5', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8C8474', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#E8DCC2'}
                onMouseLeave={e => e.currentTarget.style.background = '#FDF0D5'}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* ── Search & Filters ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', background: '#FDF6E3', padding: '14px', borderRadius: '16px', border: '1px solid #FDF0D5' }}>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} color="#9FA8A3" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, accent, language or description…"
                style={{ width: '100%', padding: '10px 12px 10px 38px', fontSize: '13px', border: '1px solid #C2B79A', borderRadius: '10px', background: '#ffffff', color: '#003049', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#003049'}
                onBlur={e => e.target.style.borderColor = '#C2B79A'}
              />
            </div>

            {/* Filter Row */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>

              {/* Gender */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={12} color="#4A5A64" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4A5A64', textTransform: 'uppercase' }}>Gender</span>
                <div style={{ display: 'flex', background: '#E8DCC2', padding: '2px', borderRadius: '8px', gap: '2px' }}>
                  {(['all', 'male', 'female'] as const).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenderFilter(g)}
                      style={{
                        padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: genderFilter === g ? '#ffffff' : 'transparent',
                        color: genderFilter === g ? '#003049' : '#8C8474',
                        boxShadow: genderFilter === g ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        textTransform: 'capitalize', transition: 'all 0.15s'
                      }}
                    >
                      {g === 'all' ? 'All' : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={12} color="#4A5A64" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4A5A64', textTransform: 'uppercase' }}>Language</span>
                <select
                  value={languageFilter}
                  onChange={e => setLanguageFilter(e.target.value)}
                  style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #C2B79A', borderRadius: '8px', background: '#ffffff', color: '#003049', outline: 'none', fontWeight: 500, cursor: 'pointer' }}
                >
                  <option value="all">All Languages</option>
                  {PINNED_LANGUAGES.map(p => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                  {uniqueLanguages.length > 0 && <option disabled>──────────</option>}
                  {uniqueLanguages.map(lang => (
                    <option key={lang} value={lang}>{getLanguageLabel(lang)}</option>
                  ))}
                </select>
              </div>

              {/* Accent */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mic2 size={12} color="#4A5A64" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4A5A64', textTransform: 'uppercase' }}>Accent</span>
                <select
                  value={accentFilter}
                  onChange={e => setAccentFilter(e.target.value)}
                  style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #C2B79A', borderRadius: '8px', background: '#ffffff', color: '#003049', outline: 'none', fontWeight: 500, cursor: 'pointer' }}
                >
                  <option value="all">All Accents</option>
                  {uniqueAccents.map(acc => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: '11px', fontWeight: 700, border: '1px solid #fca5a5', borderRadius: '8px', background: '#fff1f2', color: '#C1121F', cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Voice Grid ── */}
          <div ref={gridRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="sd-voice-explorer-grid">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                <Spinner size={36} color="#003049" />
                <span style={{ fontSize: '13px', color: '#8C8474', fontWeight: 500 }}>Loading voice library from ElevenLabs…</span>
              </div>
            ) : pageVoices.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', gap: '10px', background: '#FDF6E3', borderRadius: '16px', border: '2px dashed #C2B79A' }}>
                <X size={28} color="#9FA8A3" />
                <span style={{ fontSize: '13px', color: '#8C8474', fontWeight: 600 }}>No voices match your filters.</span>
                <button onClick={clearFilters} style={{ background: '#003049', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(250px, 100%), 1fr))', gap: '12px' }}>
                {pageVoices.map(voice => {
                  const isSelected = selectedVoiceId === voice.voice_id;
                  const isPlaying = playingVoiceId === voice.voice_id;

                  return (
                    <div
                      key={voice.voice_id}
                      className="sd-voice-card"
                      style={{
                        padding: '14px',
                        background: '#ffffff',
                        border: isSelected ? '2px solid #003049' : '1.5px solid #E8DCC2',
                        borderRadius: '14px',
                        boxShadow: isSelected ? '0 8px 20px -4px rgba(2,132,199,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        {/* Name + Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#003049', lineHeight: 1.3 }}>{voice.name}</span>
                          <div style={{ display: 'flex', gap: '3px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', background: voice.gender === 'male' ? '#e0f2fe' : '#fce7f3', color: voice.gender === 'male' ? '#1A4A66' : '#be185d' }}>
                              {voice.gender}
                            </span>
                            {voice.accent && voice.accent !== 'Global' && (
                              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', background: '#f0fdf4', color: '#15803d' }}>
                                {voice.accent}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Language tag */}
                        {voice.language && (
                          <div style={{ marginBottom: '6px' }}>
                            <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: '#FDF0D5', color: '#4A5A64' }}>
                              🌐 {getLanguageLabel(voice.language)}
                            </span>
                          </div>
                        )}

                        {/* Description */}
                        <p style={{ fontSize: '11px', color: '#8C8474', lineHeight: '1.4', margin: '0 0 12px 0', minHeight: '30px' }}>
                          {voice.description}
                        </p>
                      </div>

                      {/* Footer Actions */}
                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #FDF0D5', paddingTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => playPreview(voice.voice_id, voice.preview_url)}
                          disabled={!voice.preview_url}
                          style={{
                            flex: 1, padding: '7px', borderRadius: '8px',
                            border: '1.5px solid #E8DCC2',
                            background: isPlaying ? 'rgba(2,132,199,0.08)' : '#ffffff',
                            color: isPlaying ? '#003049' : '#4A5A64',
                            cursor: voice.preview_url ? 'pointer' : 'not-allowed',
                            fontSize: '11px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            transition: 'all 0.15s', opacity: voice.preview_url ? 1 : 0.45,
                          }}
                        >
                          {isPlaying ? <><VolumeX size={12} /> Stop</> : <><Volume2 size={12} /> Preview</>}
                        </button>

                        <button
                          type="button"
                          onClick={() => { onSelectVoice(voice.voice_id, `${voice.name} - ${voice.accent || voice.language}`); stopAudio(); }}
                          style={{
                            flex: 1.2, padding: '7px', borderRadius: '8px', border: 'none',
                            background: isSelected ? '#10b981' : '#003049',
                            color: '#ffffff', cursor: 'pointer',
                            fontSize: '11px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            transition: 'all 0.15s',
                          }}
                        >
                          {isSelected ? <><Check size={12} /> Selected</> : <><Mic2 size={12} /> Use Voice</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Pagination ── */}
          {!loading && filteredVoices.length > VOICES_PER_PAGE && (
            <div style={{ borderTop: '1px solid #E8DCC2', paddingTop: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #E8DCC2', background: '#ffffff', color: safePage === 1 ? '#C2B79A' : '#4A5A64', cursor: safePage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >
                <ChevronLeft size={14} />
              </button>

              {getPageNumbers().map((p, i) =>
                p === '...'
                  ? <span key={`ellipsis-${i}`} style={{ fontSize: '12px', color: '#9FA8A3', padding: '0 2px' }}>…</span>
                  : <PaginationBtn key={p} page={p as number} active={p === safePage} />
              )}

              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #E8DCC2', background: '#ffffff', color: safePage === totalPages ? '#C2B79A' : '#4A5A64', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >
                <ChevronRight size={14} />
              </button>

              <span style={{ fontSize: '11px', color: '#9FA8A3', marginLeft: '8px' }}>
                {pageStart + 1}–{Math.min(pageStart + VOICES_PER_PAGE, filteredVoices.length)} of {filteredVoices.length}
              </span>
            </div>
          )}

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
