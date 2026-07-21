'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
} from '@/app/components';
import { EditorialSectionHeader, editorialPillButtonClass } from '@/components/editorial/editorial-layout';

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-10">
      <EditorialSectionHeader title="Password" />

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
          <EditorialDefinitionRow label="Current password">
            <EditorialField
              value={currentPassword}
              onChange={setCurrentPassword}
              type="password"
              placeholder="••••••••"
              style={{ maxWidth: 320 }}
            />
          </EditorialDefinitionRow>

          <EditorialDefinitionRow label="New password" isLast>
            <div className="flex flex-wrap items-baseline gap-8">
              <EditorialField
                value={newPassword}
                onChange={setNewPassword}
                type="password"
                placeholder="New password"
                style={{ flex: 1, minWidth: 180 }}
              />
              <EditorialField
                value={confirmPassword}
                onChange={setConfirmPassword}
                type="password"
                placeholder="Confirm new password"
                style={{ flex: 1, minWidth: 180 }}
              />
              <button type="submit" disabled={saving} className={editorialPillButtonClass}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </div>
          </EditorialDefinitionRow>
        </EditorialDefinitionList>
      </form>
    </section>
  );
}
