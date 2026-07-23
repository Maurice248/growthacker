'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Plus, CheckCircle, XCircle, Clock, Eye, Mail, AlertCircle,
  Send, PartyPopper, RotateCcw, Trash2, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Header } from '@/components/dashboard/header';
import { PageBody } from '@/components/outreach/page-body';
import { useAppSection } from '@/lib/app-section';
import {
  EditorialSectionHeader,
  OutreachActionLink,
  OutreachListRow,
  campaignStatusPill,
  editorialPillButtonDangerClass,
} from '@/components/cold-email/outreach-ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiContent {
  campaign_name?: string;
  service_type?: string;
  subject_line?: string;
  preview_text?: string;
  body_preview?: string;
  full_email_body?: string;
}

interface Campaign {
  id: string;
  campaignName: string;
  serviceType: string;
  targetRegion: string;
  campaignGoal: string;
  selectedSheet: string;
  status: string;
  aiGeneratedContent: AiContent | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

interface ApprovalResult {
  status?: string;
  message?: string;
  execution_id?: string;
  emails_sent?: number;
  total_sent?: number;
  failed?: number;
  errors?: string[];
  error?: string;
}

type DialogState = 'preview' | 'loading' | 'success' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanEmailBody(body?: string): string {
  if (!body) return 'No email content available.';
  return body
    .replace(/\[SUBJECT LINE\]\s*/gi, '')
    .replace(/\[PREVIEW TEXT\]\s*/gi, '')
    .replace(/\[HEADER TITLE\]\s*/gi, '')
    .replace(/\[GREETING\]\s*/gi, '')
    .replace(/\[OPENING\]\s*/gi, '')
    .replace(/\[MAIN CONTENT\]\s*/gi, '')
    .replace(/\[CTA\]\s*/gi, '')
    .replace(/\[CLOSING\]\s*/gi, '')
    .replace(/\[FOOTER NOTE\]\s*/gi, '')
    .trim();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'warning' | 'success' | 'destructive' | 'secondary'; icon: React.ReactNode }> = {
    PENDING_APPROVAL: { variant: 'warning',     icon: <Clock className="mr-1 h-3 w-3" /> },
    APPROVED:         { variant: 'success',     icon: <CheckCircle className="mr-1 h-3 w-3" /> },
    REJECTED:         { variant: 'destructive', icon: <XCircle className="mr-1 h-3 w-3" /> },
    SENT:             { variant: 'success',     icon: <Mail className="mr-1 h-3 w-3" /> },
  };
  const cfg = map[status] ?? { variant: 'secondary' as const, icon: null };
  return (
    <Badge variant={cfg.variant} className="flex items-center">
      {cfg.icon}{status.replace(/_/g, ' ')}
    </Badge>
  );
}

// ─── Approval loading steps ───────────────────────────────────────────────────

const APPROVAL_STEPS = [
  { at: 0,  text: 'Processing approval...' },
  { at: 5,  text: 'Loading verified leads from your list...' },
  { at: 12, text: 'Personalising emails for each recipient...' },
  { at: 25, text: 'Pushing leads to Instantly.ai...' },
  { at: 45, text: 'Updating campaign records...' },
  { at: 60, text: 'Finishing up...' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const { basePath, labels, section } = useAppSection();
  const isOutreach = section === 'outreach';

  const [selectedCampaign, setSelectedCampaign]   = useState<Campaign | null>(null);
  const [comments, setComments]                   = useState('');
  const [dialogState, setDialogState]             = useState<DialogState>('preview');
  const [approvalResult, setApprovalResult]       = useState<ApprovalResult | null>(null);
  const [elapsed, setElapsed]                     = useState(0);

  // Tick elapsed counter while loading
  useEffect(() => {
    if (dialogState !== 'loading') { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [dialogState]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/campaigns');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<{ campaigns: Campaign[] }>;
    },
    refetchInterval: 5000,
  });

  // ── Dialog helpers ──────────────────────────────────────────────────────────

  function openReview(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setComments('');
    setDialogState('preview');
    setApprovalResult(null);
  }

  function closeDialog() {
    if (dialogState === 'loading') return; // block close during send
    setSelectedCampaign(null);
    setDialogState('preview');
    setApprovalResult(null);
    setComments('');
  }

  // ── Approval handlers ───────────────────────────────────────────────────────

  async function handleApprove() {
    if (!selectedCampaign) return;
    setDialogState('loading');
    try {
      const res = await fetch('/api/campaigns/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaign.id,
          decision: 'approved',
          comments: comments || undefined,
        }),
        signal: AbortSignal.timeout(130000),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Approval failed');
      if (json.status === 'no_leads_available' || json.success === false) {
        setApprovalResult(json);
        setDialogState('error');
        return;
      }
      setApprovalResult(json.result ?? json);
      setDialogState('success');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (err) {
      setApprovalResult({ error: err instanceof Error ? err.message : 'Unknown error' });
      setDialogState('error');
    }
  }

  async function handleReject() {
    if (!selectedCampaign) return;
    setDialogState('loading');
    try {
      const res = await fetch('/api/campaigns/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaign.id,
          decision: 'rejected',
          comments: comments || 'No reason provided',
        }),
      });
      if (!res.ok) throw new Error('Rejection failed');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      closeDialog();
      toast({ title: 'Campaign rejected' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
      setDialogState('preview');
    }
  }

  async function handleQuickReject(campaignId: string, campaignName: string) {
    if (!confirm(`Reject "${campaignName}"?`)) return;
    try {
      const res = await fetch('/api/campaigns/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, decision: 'rejected', comments: 'Quick reject' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign rejected' });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not reject campaign',
        variant: 'destructive',
      });
    }
  }

  // ── Delete campaign ────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(campaignId: string, campaignName: string) {
    if (!confirm(`Delete "${campaignName}"? This cannot be undone.`)) return;
    setDeletingId(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign deleted', description: `"${campaignName}" has been removed.` });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Could not delete campaign.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  }

  // ── Reuse campaign — pre-fill form with original data ─────────────────────
  const [reusingId, setReusingId] = useState<string | null>(null);

  async function handleReuse(campaignId: string) {
    setReusingId(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      const json = await res.json();
      if (!res.ok) throw new Error('Failed to load campaign');

      // Store original input in sessionStorage → new campaign page reads it
      sessionStorage.setItem('reuse_campaign', JSON.stringify(json.originalInput));
      router.push(`${basePath}/campaigns/new`);
    } catch {
      toast({ title: 'Error', description: 'Could not load campaign data.', variant: 'destructive' });
      setReusingId(null);
    }
  }

  const campaigns = data?.campaigns ?? [];
  const pending   = campaigns.filter((c) => c.status === 'PENDING_APPROVAL');
  const completed = campaigns.filter((c) => c.status !== 'PENDING_APPROVAL');

  // Current loading step message
  const currentStep = [...APPROVAL_STEPS].reverse().find((s) => elapsed >= s.at) ?? APPROVAL_STEPS[0];

  // ── Render ──────────────────────────────────────────────────────────────────

  const newCampaignButton = (
    <Link href={`${basePath}/campaigns/new`} className={editorialPillButtonDangerClass}>
      + New campaign
    </Link>
  );

  return (
    <div>
      <Header
        title={labels.campaignsTitle}
        description={labels.campaignsDescription}
        actions={isOutreach ? newCampaignButton : undefined}
      />

      <PageBody>
        {!isOutreach && (
          <div className="flex justify-end">
            <Button asChild className="rounded-full bg-[#C1121F] px-6 py-2.5 text-sm font-bold text-[#FDF6E3] hover:bg-[#780000]">
              <Link href={`${basePath}/campaigns/new`}>
                <Plus className="mr-2 h-4 w-4" /> New Campaign
              </Link>
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 justify-center py-8">
            <AlertCircle className="h-5 w-5" /> Failed to load campaigns
          </div>
        )}

        {/* Pending Approvals */}
        {!isLoading && pending.length > 0 && (
          <section className="space-y-4">
            {isOutreach ? (
              <>
                <EditorialSectionHeader
                  title="Pending Approval"
                  meta={`${pending.length} campaign${pending.length === 1 ? '' : 's'}`}
                />
                {pending.map((campaign) => (
                  <OutreachListRow
                    key={campaign.id}
                    title={campaign.campaignName}
                    meta={`${campaign.serviceType.replace('_', ' ')} · ${campaign.targetRegion} · ${format(new Date(campaign.createdAt), 'MMM dd, yyyy')}`}
                    actions={
                      <>
                        <OutreachActionLink onClick={() => openReview(campaign)}>
                          Review
                        </OutreachActionLink>
                        <OutreachActionLink
                          variant="muted"
                          onClick={() => handleQuickReject(campaign.id, campaign.campaignName)}
                        >
                          Reject
                        </OutreachActionLink>
                        <OutreachActionLink
                          variant="muted"
                          disabled={deletingId === campaign.id}
                          onClick={() => handleDelete(campaign.id, campaign.campaignName)}
                        >
                          Delete
                        </OutreachActionLink>
                      </>
                    }
                    status={campaignStatusPill(campaign.status)}
                  />
                ))}
              </>
            ) : (
              <>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Pending Approval
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700">
                  {pending.length}
                </span>
              </h2>
            </div>

            <div className="grid gap-4">
              {pending.map((campaign) => (
                <Card key={campaign.id} className="border-l-4 border-l-amber-400 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{campaign.campaignName}</CardTitle>
                        <CardDescription className="mt-1 flex gap-2 text-xs">
                          <span>{campaign.serviceType.replace('_', ' ')}</span>·
                          <span>{campaign.targetRegion}</span>·
                          <span>{campaign.selectedSheet}</span>
                        </CardDescription>
                      </div>
                      <StatusBadge status={campaign.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {campaign.aiGeneratedContent?.subject_line && (
                      <div className="rounded-lg bg-gray-50 border px-4 py-3 text-sm">
                        <p className="font-medium text-gray-800">
                          ✉️ {campaign.aiGeneratedContent.subject_line}
                        </p>
                        {campaign.aiGeneratedContent.preview_text && (
                          <p className="mt-1 text-gray-500 text-xs line-clamp-2">
                            {campaign.aiGeneratedContent.preview_text}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-[#003049] hover:bg-[#1A4A66] text-white"
                        onClick={() => openReview(campaign)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> Review &amp; Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleQuickReject(campaign.id, campaign.campaignName)}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Reject
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Delete campaign"
                        disabled={deletingId === campaign.id}
                        onClick={() => handleDelete(campaign.id, campaign.campaignName)}
                        className="border-red-200 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-center text-xs text-gray-400">
                      Created {format(new Date(campaign.createdAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
              </>
            )}
          </section>
        )}

        {/* Campaign History */}
        {!isLoading && (
          <section className="space-y-4">
            {isOutreach ? (
              <>
                <EditorialSectionHeader
                  title="Campaign History"
                  meta={`${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}`}
                />
                {campaigns.length === 0 ? (
                  <div className="border-t border-[var(--border)] py-16 text-center text-[var(--text-muted)]">
                    <Mail className="mx-auto mb-3 h-12 w-12 opacity-30" />
                    <p className="text-lg font-medium">No campaigns yet</p>
                    <p className="text-sm">Create your first campaign to get started</p>
                  </div>
                ) : (
                  completed.map((campaign) => (
                    <OutreachListRow
                      key={campaign.id}
                      title={campaign.campaignName}
                      meta={`${campaign.serviceType.replace('_', ' ')} · ${campaign.targetRegion} · ${format(new Date(campaign.createdAt), 'MMM dd, yyyy')}`}
                      actions={
                        <>
                          <OutreachActionLink
                            disabled={reusingId === campaign.id}
                            onClick={() => handleReuse(campaign.id)}
                          >
                            Reuse
                          </OutreachActionLink>
                          <OutreachActionLink
                            variant="muted"
                            disabled={deletingId === campaign.id}
                            onClick={() => handleDelete(campaign.id, campaign.campaignName)}
                          >
                            Delete
                          </OutreachActionLink>
                        </>
                      }
                      status={campaignStatusPill(campaign.status)}
                    />
                  ))
                )}
              </>
            ) : (
              <>
            <h2 className="text-lg font-semibold text-gray-900">Campaign History</h2>

            {campaigns.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-gray-400">
                <Mail className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-lg font-medium">No campaigns yet</p>
                <p className="text-sm">Create your first campaign to get started</p>
              </div>
            )}

            <div className="grid gap-3">
              {completed.map((campaign) => (
                <Card key={campaign.id} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{campaign.campaignName}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                          <span>{campaign.serviceType.replace('_', ' ')}</span>·
                          <span>{campaign.targetRegion}</span>·
                          <span>{format(new Date(campaign.createdAt), 'MMM dd, yyyy')}</span>
                        </div>
                        {campaign.status === 'REJECTED' && campaign.rejectionReason && (
                          <p className="mt-1 text-xs text-red-500">
                            Reason: {campaign.rejectionReason}
                          </p>
                        )}
                      </div>

                      {/* Status + Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={campaign.status} />

                        {/* Reuse button */}
                        <Button
                          variant="outline"
                          size="sm"
                          title="Reuse this campaign"
                          disabled={reusingId === campaign.id}
                          onClick={() => handleReuse(campaign.id)}
                          className="text-[#003049] border-[#003049]/30 hover:bg-[#003049]/5 gap-1.5"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Reuse
                        </Button>

                        {/* Delete button */}
                        <Button
                          variant="outline"
                          size="sm"
                          title="Delete campaign"
                          disabled={deletingId === campaign.id}
                          onClick={() => handleDelete(campaign.id, campaign.campaignName)}
                          className="text-red-500 border-red-200 hover:bg-red-50 gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
              </>
            )}
          </section>
        )}
      </PageBody>

      {/* ════════════════════════════════════════════════
          Review & Approval Dialog
          Uses flex-col so footer buttons are ALWAYS visible
      ════════════════════════════════════════════════ */}
      <Dialog
        open={!!selectedCampaign}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
      >
        {/* max-h-[90vh] + flex flex-col → scrollable body, sticky buttons */}
        <DialogContent className="max-w-2xl w-full p-0 flex flex-col max-h-[90vh] overflow-hidden">

          {/* ── PREVIEW STATE ── */}
          {dialogState === 'preview' && selectedCampaign && (
            <>
              {/* Fixed header */}
              <div className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                <DialogHeader>
                  <DialogTitle className="text-lg leading-snug">
                    Review Campaign
                    <span className="block text-sm font-normal text-gray-500 mt-0.5">
                      {selectedCampaign.campaignName}
                    </span>
                  </DialogTitle>
                </DialogHeader>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

                {/* Campaign metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Service', selectedCampaign.serviceType.replace('_', ' ')],
                    ['Region', selectedCampaign.targetRegion],
                    ['Goal', selectedCampaign.campaignGoal],
                    ['Sheet', selectedCampaign.selectedSheet],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800 text-sm">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Full email preview */}
                {selectedCampaign.aiGeneratedContent ? (
                  <div className="rounded-xl border overflow-hidden">
                    {/* Email header — subject + preview */}
                    <div className="bg-[#003049] px-5 py-4">
                      <p className="text-[11px] text-blue-200 uppercase tracking-wider mb-1">Subject Line</p>
                      <p className="text-white font-semibold text-sm leading-snug">
                        {selectedCampaign.aiGeneratedContent.subject_line ?? '—'}
                      </p>
                      {selectedCampaign.aiGeneratedContent.preview_text && (
                        <p className="text-blue-100 text-xs mt-2 leading-relaxed opacity-90">
                          {selectedCampaign.aiGeneratedContent.preview_text}
                        </p>
                      )}
                    </div>

                    {/* Full email body — scrollable up to 300px */}
                    <div className="bg-gray-50 max-h-[300px] overflow-y-auto px-5 py-4">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-3">Email Body</p>
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {cleanEmailBody(
                          selectedCampaign.aiGeneratedContent.full_email_body ||
                          selectedCampaign.aiGeneratedContent.body_preview
                        )}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed px-5 py-8 text-center text-gray-400 text-sm">
                    No AI email content was generated for this campaign.
                  </div>
                )}

                {/* Comments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Comments <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <Textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add notes or feedback before approving or rejecting..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* ★ STICKY FOOTER — always visible, never scrolls away ★ */}
              <div className="flex-shrink-0 border-t bg-white px-6 py-4 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleReject}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                  onClick={handleApprove}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve &amp; Push to Instantly
                </Button>
              </div>
            </>
          )}

          {/* ── LOADING STATE ── */}
          {dialogState === 'loading' && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center space-y-6">
              {/* Animated ring */}
              <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border-4 border-[#003049]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-[#003049] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Send className="h-7 w-7 text-[#003049]" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-900">Pushing to Instantly.ai...</h3>
                <p className="text-sm text-[#003049] mt-1 min-h-[20px]">{currentStep.text}</p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs bg-gray-100 rounded-full h-2">
                <div
                  className="bg-[#003049] h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min((elapsed / 70) * 100, 95)}%` }}
                />
              </div>

              <p className="text-xs text-gray-400">{elapsed}s elapsed · typically 10–90s</p>
              <p className="text-xs text-gray-300">Please keep this dialog open</p>
            </div>
          )}

          {/* ── SUCCESS STATE ── */}
          {dialogState === 'success' && approvalResult && (
            <div className="flex flex-col px-6 py-10 text-center space-y-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <PartyPopper className="h-10 w-10 text-green-600" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900">Campaign Approved!</h3>
                <p className="text-sm text-gray-500 mt-1">Leads pushed to your Instantly.ai campaign</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 w-full">
                {(approvalResult.emails_sent != null || approvalResult.total_sent != null) ? (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                    <p className="text-3xl font-bold text-green-700">
                      {approvalResult.emails_sent ?? approvalResult.total_sent}
                    </p>
                    <p className="text-xs text-green-600 mt-1">Emails Sent</p>
                  </div>
                ) : (
                  <div className="col-span-2 rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-700 font-medium text-left">
                      Emails sent successfully via Instantly.ai
                    </p>
                  </div>
                )}
                {(approvalResult.failed ?? 0) > 0 && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                    <p className="text-3xl font-bold text-red-600">{approvalResult.failed}</p>
                    <p className="text-xs text-red-500 mt-1">Failed</p>
                  </div>
                )}
              </div>

              {/* Result message */}
              {(approvalResult.message || approvalResult.execution_id) && (
                <div className="w-full rounded-lg bg-gray-50 border px-4 py-3 text-left space-y-1">
                  {approvalResult.message && (
                    <p className="text-sm text-gray-700">{approvalResult.message}</p>
                  )}
                  {approvalResult.execution_id && (
                    <p className="text-xs text-gray-400">Execution ID: {approvalResult.execution_id}</p>
                  )}
                </div>
              )}

              {/* Warnings */}
              {approvalResult.errors && approvalResult.errors.length > 0 && (
                <div className="w-full rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-left">
                  <p className="text-xs font-semibold text-yellow-800 mb-2">
                    Warnings ({approvalResult.errors.length})
                  </p>
                  <ul className="space-y-1">
                    {approvalResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-yellow-700">• {e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                className="w-full bg-[#003049] hover:bg-[#1A4A66] text-white"
                onClick={closeDialog}
              >
                Done
              </Button>
            </div>
          )}

          {/* ── ERROR STATE ── */}
          {dialogState === 'error' && approvalResult && (
            <div className="flex flex-col px-6 py-10 text-center space-y-5">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900">Approval Failed</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Failed to push leads to Instantly.ai
                </p>
              </div>

              <div className="w-full rounded-lg bg-red-50 border border-red-200 px-4 py-4 text-left">
                <p className="text-sm text-red-700">
                  {approvalResult.error ?? approvalResult.message ?? 'An unknown error occurred. Check your API keys and Instantly campaign ID.'}
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setDialogState('preview'); setApprovalResult(null); }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Try Again
                </Button>
                <Button
                  className="flex-1 bg-[#003049] hover:bg-[#1A4A66] text-white"
                  onClick={closeDialog}
                >
                  Close
                </Button>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}
