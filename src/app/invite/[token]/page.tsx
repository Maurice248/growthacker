'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AlertCircle, ArrowRight, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type InviteInfo = {
  email: string;
  role: string;
  companyName: string;
  expiresAt: string;
};

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link.');
      setLoadingInvite(false);
      return;
    }

    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid invite');
        setInvite(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Invalid invite');
      })
      .finally(() => setLoadingInvite(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join company');

      const signInResult = await signIn('credentials', {
        email: data.email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push('/client-login');
        return;
      }

      router.push('/client-dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join company');
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Loading invite...</p>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h1 className="text-xl font-bold text-slate-900">Invite unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">{error || 'This invite link is invalid or has expired.'}</p>
          <Link href="/client-login" className="mt-6 inline-block text-sm font-medium text-slate-900 hover:underline">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <User className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Join {invite.companyName}</h1>
          <p className="mt-2 text-sm text-slate-500">
            You&apos;ve been invited as <span className="font-medium">{invite.email}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="!pl-11"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="!pl-11"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="!pl-11"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            {submitting ? 'Joining...' : 'Join company'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/client-login" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
