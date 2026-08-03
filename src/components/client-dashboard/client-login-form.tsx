'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import { Building2, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function waitForSession(maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const session = await getSession();
    if (session?.user?.id) return session;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
}

export function ClientLoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/client-dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError(
          result.error === 'Configuration'
            ? 'Authentication is misconfigured in production. Set NEXTAUTH_SECRET and NEXTAUTH_URL in Vercel.'
            : 'Invalid email or password.'
        );
        return;
      }

      if (!result?.ok) {
        setError('Sign-in failed. Please try again.');
        return;
      }

      const session = await waitForSession();
      if (!session?.user?.id) {
        setError(
          'Signed in, but the session cookie was not saved. In Vercel, set NEXTAUTH_SECRET and NEXTAUTH_URL to your production domain, then redeploy.'
        );
        return;
      }

      if (session.user.isAppAdmin) {
        window.location.assign('/admin');
        return;
      }

      if (!session.user.companyId) {
        setError(
          'This account is not linked to a company yet. Run database seed on production or register a new workspace.'
        );
        return;
      }

      window.location.assign(callbackUrl);
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">LOGIN</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to access your client dashboard</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="!pl-11"
                required
                autoComplete="email"
              />
            </div>
          </div>

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
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/client-register" className="font-medium text-slate-900 hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          Joining an existing team? Use the invite link from your company admin.
        </p>
      </div>
    </div>
  );
}
