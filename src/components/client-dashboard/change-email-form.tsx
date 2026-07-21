'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
} from '@/app/components';
import { EditorialSectionHeader, editorialPillButtonClass } from '@/components/editorial/editorial-layout';

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedNew = newEmail.trim().toLowerCase();
    const normalizedConfirm = confirmEmail.trim().toLowerCase();

    if (normalizedNew !== normalizedConfirm) {
      setError('Email addresses do not match.');
      return;
    }

    if (normalizedNew === currentEmail.toLowerCase()) {
      setError('New email must be different from your current email.');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/account/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: normalizedNew, currentPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change email');

      setNewEmail('');
      setConfirmEmail('');
      setCurrentPassword('');
      setSuccess('Email updated successfully. Use your new email the next time you sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change email');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <EditorialSectionHeader title="Email" />

      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--red)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[#38678A]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <EditorialDefinitionList>
          <EditorialDefinitionRow label="Current email">
            <div className="text-[15px] text-[var(--text-muted)]">{currentEmail}</div>
          </EditorialDefinitionRow>

          <EditorialDefinitionRow label="New email">
            <div className="flex flex-wrap gap-8">
              <EditorialField
                value={newEmail}
                onChange={setNewEmail}
                type="email"
                placeholder="New email"
                style={{ flex: 1, minWidth: 200 }}
              />
              <EditorialField
                value={confirmEmail}
                onChange={setConfirmEmail}
                type="email"
                placeholder="Confirm new email"
                style={{ flex: 1, minWidth: 200 }}
              />
            </div>
          </EditorialDefinitionRow>

          <EditorialDefinitionRow label="Current password" isLast>
            <div className="flex flex-wrap items-baseline gap-6">
              <EditorialField
                value={currentPassword}
                onChange={setCurrentPassword}
                type="password"
                placeholder="••••••••"
                style={{ flex: 1, minWidth: 200 }}
              />
              <button type="submit" disabled={saving} className={editorialPillButtonClass}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update email'
                )}
              </button>
            </div>
          </EditorialDefinitionRow>
        </EditorialDefinitionList>
      </form>
    </section>
  );
}
