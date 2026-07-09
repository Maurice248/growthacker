'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search, Loader2, CheckCircle, History,
  XCircle, Clock, Database, Mail,
} from 'lucide-react';
import { Header } from '@/components/dashboard/header';
import { PageBody } from '@/components/outreach/page-body';
import { useAppSection } from '@/lib/app-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupabaseInfo {
  totalLeadsRequested: number;
  totalLeadsScraped: number;
  saveStatus: string;
}

interface EmailVerificationStats {
  verified: number;
  catchAll: number;
  invalid: number;
  unknown: number;
  bounceRiskRemoved: number;
}

interface ScraperResult {
  status: string;
  timestamp?: string;
  executionTime?: number;
  destination: string;
  location: string;
  niches: string;
  supabaseInfo: SupabaseInfo;
  emailVerification?: EmailVerificationStats;
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(iso?: string) {
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'MMM dd, yyyy · h:mm a');
  } catch {
    return iso;
  }
}

function normalizeClientResult(
  data: Record<string, unknown>,
  fallback: { niches: string; location: string; targetSheet: string }
): ScraperResult {
  const supabaseRaw = (data.supabaseInfo ?? data.supabase_info) as Record<string, unknown> | undefined;
  const emailStatsRaw = (data.emailVerification ?? data.email_verification_stats ?? data.emailVerificationStats) as Record<string, unknown> | undefined;
  const rawSummary = (data.summary ?? data.scraper_summary) as Record<string, unknown> | undefined;

  const totalLeadsScraped = Number(
    supabaseRaw?.total_leads_scraped ?? supabaseRaw?.totalLeadsScraped ??
    rawSummary?.total_scraped ?? rawSummary?.totalScraped ?? 0
  ) || 0;

  const supabaseInfo: SupabaseInfo = {
    totalLeadsRequested: Number(
      supabaseRaw?.total_leads_requested ?? supabaseRaw?.totalLeadsRequested ?? 0
    ) || 0,
    totalLeadsScraped,
    saveStatus: String(
      supabaseRaw?.save_status ?? supabaseRaw?.saveStatus ?? 'unknown'
    ),
  };

  const emailVerification: EmailVerificationStats | undefined = emailStatsRaw
    ? {
        verified: Number(emailStatsRaw.verified ?? 0) || 0,
        catchAll: Number(emailStatsRaw.catch_all ?? emailStatsRaw.catchAll ?? 0) || 0,
        invalid: Number(emailStatsRaw.invalid ?? 0) || 0,
        unknown: Number(emailStatsRaw.unknown ?? 0) || 0,
        bounceRiskRemoved: Number(emailStatsRaw.bounce_risk_removed ?? emailStatsRaw.bounceRiskRemoved ?? 0) || 0,
      }
    : undefined;

  return {
    status: String(data.status ?? 'success'),
    timestamp: data.timestamp ? String(data.timestamp) : undefined,
    executionTime: Number(data.executionTime ?? data.execution_time_seconds) || undefined,
    destination: String(data.destination ?? fallback.targetSheet),
    location: String(rawSummary?.location ?? fallback.location),
    niches: String(rawSummary?.niches ?? fallback.niches),
    supabaseInfo,
    emailVerification,
  };
}

type PageState = 'form' | 'loading' | 'success' | 'error';

// ─── Loading steps (2-5 min process) ─────────────────────────────────────────

const LOADING_STEPS = [
  { at: 0,   text: 'Starting lead scraper...' },
  { at: 8,   text: 'Connecting to Apify leads finder...' },
  { at: 20,  text: 'Searching for matching contacts...' },
  { at: 60,  text: 'Extracting contact details...' },
  { at: 120, text: 'Validating email addresses with Million Verifier...' },
  { at: 180, text: 'Saving verified leads to your list...' },
  { at: 240, text: 'Finalising and updating records...' },
  { at: 290, text: 'Almost done — wrapping up...' },
];

interface LeadListOption {
  id: string;
  name: string;
  _count?: { leads: number };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScraperPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { basePath, labels } = useAppSection();

  const [pageState, setPageState] = useState<PageState>('form');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [niches, setNiches] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState('100');
  const [targetSheet, setTargetSheet] = useState('');
  const [leadLists, setLeadLists] = useState<LeadListOption[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cold-email/lists')
      .then((r) => r.json())
      .then((data) => setLeadLists(data.lists || []))
      .catch(() => setLeadLists([]))
      .finally(() => setListsLoading(false));
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (pageState !== 'loading') { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [pageState]);

  const currentStep = [...LOADING_STEPS].reverse().find((s) => elapsed >= s.at) ?? LOADING_STEPS[0];
  const progressPct = Math.min((elapsed / 300) * 100, 95);

  function formatTime(s: number) {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!niches.trim() || !location.trim() || !targetSheet) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    setPageState('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niches: niches.trim(),
          location: location.trim(),
          max_results: Number(maxResults),
          target_sheet: targetSheet,
          list_id: targetSheet,
        }),
        signal: AbortSignal.timeout(320000),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Scraper failed');
      }

      const normalized = normalizeClientResult(
        typeof data === 'object' && data !== null ? data : {},
        {
        niches: niches.trim(),
        location: location.trim(),
        targetSheet,
      });
      setResult(normalized);
      setPageState('success');
      queryClient.invalidateQueries({ queryKey: ['scraper-jobs'] });
      toast({
        title: '✅ Scraping complete!',
        description: `${normalized.supabaseInfo.totalLeadsScraped} leads found, ${normalized.supabaseInfo.totalLeadsRequested} requested.`,
      });

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error occurred');
      setPageState('error');
      toast({ title: 'Scraper failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    }
  }

  // ── FORM ───────────────────────────────────────────────────────────────────

  if (pageState === 'form' || pageState === 'loading') {
    return (
      <div>
        <Header
          title="Lead Scraper"
          description={labels.scraperDescription}
        />

        {/* Full-screen loading overlay */}
        {pageState === 'loading' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center space-y-6">
              <div className="relative mx-auto h-20 w-20">
                <div className="absolute inset-0 rounded-full border-4 border-[#0077b6]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#0077b6] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="h-8 w-8 text-[#0077b6]" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900">Scraping Google Maps...</h3>
                <p className="text-sm text-[#0077b6] mt-1 min-h-[20px] font-medium">{currentStep.text}</p>
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-[#0077b6] h-2.5 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                <span>{formatTime(elapsed)} elapsed · typically 2–5 minutes</span>
              </div>

              <p className="text-xs text-gray-300">Do not close this tab</p>
            </div>
          </div>
        )}

        <PageBody className="max-w-2xl mx-auto">
          <div className="flex justify-end mb-4">
            <Button variant="outline" asChild className="gap-2 text-sm">
              <Link href={`${basePath}/scraper/history`}>
                <History className="h-4 w-4" /> View History
              </Link>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search Configuration</CardTitle>
                <CardDescription>Configure what to scrape on Google Maps via Apify</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Niches */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Niches <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={niches}
                    onChange={(e) => setNiches(e.target.value)}
                    placeholder="e.g. property management company, landlord association, real estate investor, rental property manager"
                    disabled={pageState === 'loading'}
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated list of business types to search</p>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Toronto Canada, Vancouver Canada, Calgary Canada"
                    disabled={pageState === 'loading'}
                  />
                </div>

                {/* Max Results */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Results <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={10}
                    max={500}
                    value={maxResults}
                    onChange={(e) => setMaxResults(e.target.value)}
                    disabled={pageState === 'loading'}
                  />
                  <p className="text-xs text-gray-400 mt-1">Max 500 per run. More results = longer time.</p>
                </div>

                {/* Target Sheet */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Save Verified Leads To <span className="text-red-500">*</span>
                  </label>
                  <Select onValueChange={setTargetSheet} disabled={pageState === 'loading' || listsLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={listsLoading ? 'Loading lists...' : 'Select lead list'} />
                    </SelectTrigger>
                    <SelectContent>
                      {leadLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list._count?.leads ?? 0} leads)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-1">
                    Only verified emails are saved.{' '}
                    <Link href={`${basePath}/settings`} className="text-[#0077b6] hover:underline">
                      Manage lists in Settings
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Info box */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">What gets saved to your lead list:</p>
              <p className="text-xs text-blue-700">
                first_name · last_name · mobile_number · email · linkedin · city · country · email_status
              </p>
              <p className="text-xs text-blue-600 mt-1">Invalid and catch-all emails are filtered out automatically.</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Note:</strong> Scraping takes 2–5 minutes depending on result count. Keep this tab open.
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0077b6] hover:bg-[#005f8f] text-white"
              size="lg"
              disabled={pageState === 'loading'}
            >
              {pageState === 'loading' ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Scraping in progress...</>
              ) : (
                <><Search className="mr-2 h-5 w-5" /> Start Lead Scraping</>
              )}
            </Button>
          </form>
        </PageBody>
      </div>
    );
  }

  // ── SUCCESS ────────────────────────────────────────────────────────────────

  if (pageState === 'success' && result) {
    const { supabaseInfo, emailVerification, executionTime } = result;
    const isSuccess = result.status.toLowerCase() === 'success';

    return (
      <div>
        <Header title="Lead Scraper" description="Scraping completed successfully" />

        <PageBody className="max-w-2xl mx-auto space-y-6">
          {/* Success header */}
          <div className="flex flex-col items-center text-center py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-3">
              <CheckCircle className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Scraping Complete!</h2>
            <p className="text-sm text-gray-500 mt-1">
              {result.location} · {result.niches}
            </p>
          </div>

          {/* Run overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#0077b6]" />
                Run Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                <span className="text-gray-500">Process Status</span>
                <span className={`font-medium capitalize ${isSuccess ? 'text-green-600' : 'text-amber-600'}`}>
                  {formatStatusLabel(result.status)}
                </span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                <span className="text-gray-500">Completed At</span>
                <span className="font-medium">{formatTimestamp(result.timestamp)}</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">
                  {executionTime ? formatTime(executionTime) : formatTime(elapsed)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Scraping results */}
          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <Database className="h-4 w-4" />
                Scraping Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                <span className="text-gray-500">Lead Category</span>
                <span className="font-medium text-right max-w-[60%]">{result.destination}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                <span className="text-gray-500">Leads Requested</span>
                <span className="font-bold text-[#0077b6]">{supabaseInfo.totalLeadsRequested}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                <span className="text-gray-500">Leads Found</span>
                <span className="font-bold text-green-600">{supabaseInfo.totalLeadsScraped}</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">Database Save</span>
                <span className={`font-medium capitalize ${supabaseInfo.saveStatus.toLowerCase() === 'success' ? 'text-green-600' : 'text-amber-600'}`}>
                  {formatStatusLabel(supabaseInfo.saveStatus)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Email verification */}
          {emailVerification && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#0077b6]" />
                  Email Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Verified', value: emailVerification.verified, color: 'text-green-600 bg-green-50 border-green-200' },
                    { label: 'Invalid', value: emailVerification.invalid, color: 'text-red-500 bg-red-50 border-red-200' },
                    { label: 'Unknown', value: emailVerification.unknown, color: 'text-gray-500 bg-gray-50 border-gray-200' },
                    { label: 'Catch-All', value: emailVerification.catchAll, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                    { label: 'Bounce Risk Removed', value: emailVerification.bounceRiskRemoved, color: 'text-orange-600 bg-orange-50 border-orange-200' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
                      <p className="text-xl font-bold">{value}</p>
                      <p className="text-xs mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setPageState('form');
                setNiches('');
                setLocation('');
                setMaxResults('100');
                setTargetSheet('');
              }}
            >
              <Search className="h-4 w-4" /> Scrape Again
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href={`${basePath}/scraper/history`}>
                <History className="h-4 w-4" /> View History
              </Link>
            </Button>
          </div>
        </PageBody>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header title="Lead Scraper" description="Something went wrong" />
      <PageBody className="max-w-md mx-auto mt-8">
        <Card className="border-red-200">
          <CardContent className="pt-8 pb-6 text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-9 w-9 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Scraper Failed</h3>
              <p className="text-sm text-gray-500 mt-1">Lead scraper returned an error</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-left">
              {errorMsg || 'Unknown error occurred. Check your API keys in API key management.'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setPageState('form')}>
                Try Again
              </Button>
              <Button asChild variant="outline">
                <Link href={`${basePath}/scraper/history`}>View History</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </div>
  );
}
