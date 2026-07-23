'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search, CheckCircle, XCircle, HelpCircle, ArrowLeft,
  ExternalLink, AlertCircle, Clock,
} from 'lucide-react';
import { Header } from '@/components/dashboard/header';
import { PageBody } from '@/components/outreach/page-body';
import { useAppSection } from '@/lib/app-section';
import {
  EditorialSectionHeader,
  EditorialStatCell,
  EditorialStatRibbon,
  editorialPillButtonDangerClass,
} from '@/components/cold-email/outreach-ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDuration } from '@/lib/utils';

interface ScraperJob {
  id: string;
  niches: string;
  location: string;
  maxResults: number;
  totalScraped: number;
  validEmails: number;
  invalidEmails: number;
  targetSheet: string;
  createdAt: string;
  execution: {
    status: string;
    duration: number | null;
    outputData: string | null;
  };
}

function statusVariant(status: string): 'success' | 'destructive' | 'secondary' | 'warning' {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'destructive';
  if (status === 'RUNNING') return 'secondary';
  return 'warning';
}

function SuccessRate({ valid, total }: { valid: number; total: number }) {
  if (total === 0) return <span className="text-gray-400">—</span>;
  const rate = Math.round((valid / total) * 100);
  return (
    <span className={rate >= 60 ? 'text-green-600 font-semibold' : rate >= 30 ? 'text-amber-600 font-semibold' : 'text-red-500 font-semibold'}>
      {rate}%
    </span>
  );
}

export default function ScraperHistoryPage() {
  const { basePath, section } = useAppSection();
  const isOutreach = section === 'outreach';
  const { data, isLoading, error } = useQuery({
    queryKey: ['scraper-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/scraper/jobs');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<{ jobs: ScraperJob[] }>;
    },
    refetchInterval: 10000,
  });

  const jobs = data?.jobs ?? [];

  const totalScraped = jobs.reduce((a, j) => a + j.totalScraped, 0);
  const totalVerified = jobs.reduce((a, j) => a + j.validEmails, 0);
  const totalInvalid = jobs.reduce((a, j) => a + j.invalidEmails, 0);

  return (
    <div>
      <Header
        title="Scraper History"
        description="All past Google Maps scraping runs."
        actions={
          isOutreach ? (
            <Link href={`${basePath}/scraper`} className={editorialPillButtonDangerClass}>
              New scrape
            </Link>
          ) : undefined
        }
      />

      <PageBody className="space-y-5">
        {!isOutreach && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild className="text-gray-600 gap-2">
            <Link href={`${basePath}/scraper`}>
              <ArrowLeft className="h-4 w-4" /> Back to Scraper
            </Link>
          </Button>
          <Button asChild className="rounded-full bg-[#C1121F] px-6 py-2.5 text-sm font-bold text-[#FDF6E3] hover:bg-[#780000] gap-2">
            <Link href={`${basePath}/scraper`}>
              <Search className="h-4 w-4" /> New Scrape
            </Link>
          </Button>
        </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 justify-center py-10">
            <AlertCircle className="h-5 w-5" /> Failed to load scraper history
          </div>
        )}

        {/* Empty */}
        {!isLoading && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-gray-400">
            <Search className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No scraper runs yet</p>
            <p className="text-sm mb-4">Start a scrape to find leads on Google Maps</p>
            <Button asChild className="bg-[#003049] hover:bg-[#1A4A66] text-white">
              <Link href={`${basePath}/scraper`}>Start Scraping</Link>
            </Button>
          </div>
        )}

        {/* Summary cards */}
        {!isLoading && jobs.length > 0 && (
          <>
            {isOutreach ? (
              <>
                <EditorialStatRibbon columns={4} className="mb-10">
                  <EditorialStatCell isFirst label="Total runs" value={jobs.length} className="py-5 text-[30px]" />
                  <EditorialStatCell label="Total scraped" value={totalScraped.toLocaleString()} className="py-5 text-[30px]" />
                  <EditorialStatCell label="Verified leads" value={totalVerified.toLocaleString()} className="py-5 text-[30px]" accent="muted" />
                  <EditorialStatCell isLast label="Invalid" value={totalInvalid.toLocaleString()} className="py-5 text-[30px]" accent="danger" />
                </EditorialStatRibbon>

                <section>
                  <EditorialSectionHeader title="All Scraper Runs" meta={`${jobs.length} runs`} />
                  <div className="grid grid-cols-[minmax(140px,1.4fr)_minmax(0,1fr)_56px_64px_56px_48px_auto_auto] items-baseline gap-3.5 px-0 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] max-lg:hidden">
                    <div>Niches · location</div>
                    <div>Sheet</div>
                    <div className="text-right">Total</div>
                    <div className="text-right">Verified</div>
                    <div className="text-right">Invalid</div>
                    <div className="text-right">Rate</div>
                    <div>Duration</div>
                    <div>Date</div>
                  </div>
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="grid grid-cols-1 gap-2 border-t border-[var(--border)] py-3.5 max-lg:gap-1 lg:grid-cols-[minmax(140px,1.4fr)_minmax(0,1fr)_56px_64px_56px_48px_auto_auto] lg:items-center lg:gap-3.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[var(--primary)]">{job.niches}</div>
                        <div className="text-xs text-[var(--text-muted)]">{job.location}</div>
                      </div>
                      <div className="truncate text-[12.5px] text-[var(--text-muted)]">{job.targetSheet}</div>
                      <div className="text-sm text-[#4A5A64] lg:text-right">{job.totalScraped}</div>
                      <div className="text-sm font-bold text-[#38678A] lg:text-right">{job.validEmails}</div>
                      <div className="text-sm text-[var(--red)] lg:text-right">{job.invalidEmails}</div>
                      <div className="text-sm font-bold text-[var(--primary)] lg:text-right">
                        <SuccessRate valid={job.validEmails} total={job.totalScraped} />
                      </div>
                      <div className="text-[12.5px] text-[var(--text-muted)]">
                        {formatDuration(job.execution.duration)}
                      </div>
                      <div className="text-[12.5px] text-[var(--text-muted)]">
                        {format(new Date(job.createdAt), 'MMM dd, HH:mm')}
                      </div>
                    </div>
                  ))}
                </section>
              </>
            ) : (
              <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Total Runs', value: jobs.length, icon: Search },
                { label: 'Total Scraped', value: totalScraped.toLocaleString(), icon: Search },
                { label: 'Verified Leads', value: totalVerified.toLocaleString(), icon: CheckCircle },
                { label: 'Invalid', value: totalInvalid.toLocaleString(), icon: XCircle },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label} className="text-center">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#003049]" />
                  All Scraper Runs ({jobs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Niches</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Sheet</TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1">
                          <Search className="h-3 w-3" /> Total
                        </span>
                      </TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" /> Verified
                        </span>
                      </TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle className="h-3 w-3" /> Invalid
                        </span>
                      </TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Sheet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => {
                      // Try to get sheet URL from outputData
                      let sheetUrl: string | null = null;
                      try {
                        if (job.execution.outputData) {
                          const out = JSON.parse(job.execution.outputData);
                          sheetUrl = out?.sheet_info?.sheet_url ?? null;
                        }
                      } catch {}

                      return (
                        <TableRow key={job.id}>
                          <TableCell className="max-w-[140px]">
                            <p className="text-sm font-medium truncate" title={job.niches}>
                              {job.niches}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm">{job.location}</TableCell>
                          <TableCell className="text-xs text-gray-500 max-w-[120px] truncate">
                            {job.targetSheet}
                          </TableCell>
                          <TableCell className="font-medium">{job.totalScraped}</TableCell>
                          <TableCell className="text-green-600 font-medium">{job.validEmails}</TableCell>
                          <TableCell className="text-red-500">{job.invalidEmails}</TableCell>
                          <TableCell>
                            <SuccessRate valid={job.validEmails} total={job.totalScraped} />
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(job.execution.status)}>
                              {job.execution.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDuration(job.execution.duration)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                            {format(new Date(job.createdAt), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell>
                            {sheetUrl ? (
                              <a
                                href={sheetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#003049] hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" /> Open
                              </a>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
              </>
            )}
          </>
        )}
      </PageBody>
    </div>
  );
}
