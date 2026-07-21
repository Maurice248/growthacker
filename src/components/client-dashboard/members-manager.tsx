'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
  EditorialStatusPill,
} from '@/app/components';
import { EditorialSectionHeader, editorialPillButtonClass } from '@/components/editorial/editorial-layout';
import { OutreachSelect } from '@/components/cold-email/outreach-ui';

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function roleLabel(role: string) {
  return role === 'COMPANY_ADMIN' ? 'Admin' : 'Member';
}

type MembersManagerProps = {
  currentUserId: string;
};

export function MembersManager({ currentUserId }: MembersManagerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'COMPANY_MEMBER' | 'COMPANY_ADMIN'>('COMPANY_MEMBER');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch('/api/companies/members'),
        fetch('/api/companies/invites'),
      ]);

      const membersData = await membersRes.json();
      const invitesData = await invitesRes.json();

      if (!membersRes.ok) throw new Error(membersData.error || 'Failed to load members');
      if (!invitesRes.ok) throw new Error(invitesData.error || 'Failed to load invites');

      setMembers(membersData);
      setInvites(invitesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setInviteUrl(null);
    setCreatingInvite(true);

    try {
      const res = await fetch('/api/companies/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invite');

      setInviteUrl(data.inviteUrl);
      setInviteEmail('');
      setSuccess('Invite created. Copy the link and share it with your teammate.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInviteUrl = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy link.');
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    setActionId(memberId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/companies/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');

      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: data.role } : m)));
      setSuccess('Member role updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from your company?')) return;

    setActionId(memberId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/companies/members/${memberId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSuccess('Member removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setActionId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setActionId(inviteId);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/companies/invites/${inviteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke invite');

      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      setSuccess('Invite revoked.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team…
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--red)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[#38678A]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <section>
        <EditorialSectionHeader title="Invite Member" meta="Invite link expires in 7 days" />
        <form onSubmit={handleCreateInvite}>
          <EditorialDefinitionList>
            <EditorialDefinitionRow label="Email & role" isLast>
              <div className="flex flex-wrap items-baseline gap-6">
                <EditorialField
                  value={inviteEmail}
                  onChange={setInviteEmail}
                  type="email"
                  placeholder="teammate@company.com"
                  style={{ flex: 1.6, minWidth: 220 }}
                />
                <OutreachSelect
                  value={inviteRole}
                  onChange={(v) => setInviteRole(v as 'COMPANY_MEMBER' | 'COMPANY_ADMIN')}
                  options={[
                    { value: 'COMPANY_MEMBER', label: 'Member' },
                    { value: 'COMPANY_ADMIN', label: 'Admin' },
                  ]}
                  className="min-w-[110px] flex-[0.6]"
                />
                <button type="submit" disabled={creatingInvite} className={editorialPillButtonClass}>
                  {creatingInvite ? 'Creating…' : 'Generate invite link'}
                </button>
              </div>
            </EditorialDefinitionRow>
          </EditorialDefinitionList>
        </form>

        {inviteUrl && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
            <EditorialField value={inviteUrl} disabled style={{ flex: 1, minWidth: 240, fontSize: 13 }} />
            <button
              type="button"
              onClick={copyInviteUrl}
              className="text-sm font-bold text-[var(--primary)] underline decoration-[#C2B79A] underline-offset-4 hover:text-[var(--red)] hover:decoration-[var(--red)]"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        )}
      </section>

      {invites.length > 0 && (
        <section className="mt-10">
          <EditorialSectionHeader
            title="Pending Invites"
            meta={`${invites.length} pending`}
          />
          <div
            className="grid gap-5 px-0 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]"
            style={{ gridTemplateColumns: 'minmax(0,1.1fr) auto auto auto' }}
          >
            <div>Email</div>
            <div>Role</div>
            <div>Expires</div>
            <div />
          </div>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="grid items-center gap-5 border-t border-[var(--border)] py-4"
              style={{ gridTemplateColumns: 'minmax(0,1.1fr) auto auto auto' }}
            >
              <div className="truncate text-sm font-bold text-[var(--primary)]">{inv.email}</div>
              <EditorialStatusPill variant="neutral">{roleLabel(inv.role)}</EditorialStatusPill>
              <div className="text-[13px] text-[var(--text-muted)]">{formatDate(inv.expiresAt)}</div>
              <button
                type="button"
                disabled={actionId === inv.id}
                onClick={() => handleRevokeInvite(inv.id)}
                className="text-[13px] text-[var(--text-muted)] hover:text-[var(--red)] disabled:opacity-50"
              >
                {actionId === inv.id ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10">
        <EditorialSectionHeader
          title="Team Members"
          meta={`${members.length} ${members.length === 1 ? 'person' : 'people'}`}
        />

        <div
          className="grid gap-5 px-0 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]"
          style={{
            gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.3fr) auto auto auto',
          }}
        >
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Joined</div>
          <div />
        </div>

        {members.map((member, index) => {
          const isSelf = member.id === currentUserId;
          const displayName = member.name || member.email.split('@')[0];
          const isLast = index === members.length - 1;

          return (
            <div
              key={member.id}
              className={`grid items-center gap-5 border-t border-[var(--border)] py-[18px] ${isLast ? 'border-b' : ''}`}
              style={{
                gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.3fr) auto auto auto',
              }}
            >
              <div className="text-[15px] font-bold text-[var(--primary)]">
                {displayName}
                {isSelf && <span className="ml-2 text-[12.5px] font-normal text-[var(--text-muted)]">(you)</span>}
              </div>
              <div className="truncate text-sm text-[#4A5A64]">{member.email}</div>
              <div>
                {isSelf ? (
                  <EditorialStatusPill variant="danger">{roleLabel(member.role)}</EditorialStatusPill>
                ) : (
                  <OutreachSelect
                    value={member.role === 'COMPANY_ADMIN' ? 'COMPANY_ADMIN' : 'COMPANY_MEMBER'}
                    onChange={(v) => handleRoleChange(member.id, v)}
                    disabled={actionId === member.id}
                    options={[
                      { value: 'COMPANY_MEMBER', label: 'Member' },
                      { value: 'COMPANY_ADMIN', label: 'Admin' },
                    ]}
                    className="min-w-[110px]"
                  />
                )}
              </div>
              <div className="text-[13px] text-[var(--text-muted)]">{formatDate(member.createdAt)}</div>
              <div>
                {!isSelf && (
                  <button
                    type="button"
                    disabled={actionId === member.id}
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-[13px] text-[var(--text-muted)] hover:text-[var(--red)] disabled:opacity-50"
                  >
                    {actionId === member.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
