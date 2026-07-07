'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Email</CardTitle>
        <CardDescription>Update the email address you use to sign in.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentEmail">Current email</Label>
            <Input id="currentEmail" type="email" value={currentEmail} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newEmail">New email</Label>
            <Input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmEmail">Confirm new email</Label>
            <Input
              id="confirmEmail"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailCurrentPassword">Current password</Label>
            <Input
              id="emailCurrentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update email'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
