'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ModuleStatus } from '@/lib/company-module-status';
import { CLIENT_HOME_TAB_ID } from '@/lib/client-dashboard-nav';

type OnboardingPageProps = {
  initialCompanyName: string;
  modules: ModuleStatus[];
};

export function OnboardingWizard({ initialCompanyName, modules }: OnboardingPageProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCompanyName && initialCompanyName !== 'My Company') {
      setCompanyName(initialCompanyName);
    }
  }, [initialCompanyName]);

  const finishOnboarding = async (skipForNow = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/companies/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: skipForNow ? undefined : companyName.trim(),
          skipForNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save.');
        setLoading(false);
        return;
      }
      router.push(`/client-dashboard/workspace/${CLIENT_HOME_TAB_ID}`);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleCompanySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Enter your company name to continue.');
      return;
    }
    setError(null);
    setStep(2);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome — let&apos;s set up your workspace</h1>
        <p className="mt-2 text-sm text-slate-500">
          Step {step} of 2 — company profile and integration checklist
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleCompanySubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Marketing"
              required
            />
            <p className="text-xs text-slate-500">Shown in your client dashboard and white-label workspace.</p>
          </div>
          <Button type="submit" className="w-full gap-2">
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <KeyRound className="h-4 w-4" />
            Connect integrations per module
          </div>
          <p className="text-sm text-slate-500">
            Each workspace module unlocks after its required API keys are saved in Settings.
          </p>
          <ul className="space-y-3">
            {modules.map((module) => (
              <li
                key={module.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3"
              >
                <CheckCircle2
                  className={`mt-0.5 h-5 w-5 shrink-0 ${module.configured ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <div>
                  <p className="font-medium text-slate-900">{module.label}</p>
                  <p className="text-xs text-slate-500">
                    {module.configured
                      ? 'Ready'
                      : `Needs: ${module.missingKeys.join(', ')}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/client-dashboard/apis">Configure API keys</Link>
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2"
              disabled={loading}
              onClick={() => finishOnboarding(false)}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Finish setup
            </Button>
          </div>
          <button
            type="button"
            className="w-full text-center text-xs text-slate-500 hover:text-slate-700"
            disabled={loading}
            onClick={() => finishOnboarding(true)}
          >
            Skip for now — configure integrations later
          </button>
        </div>
      )}
    </div>
  );
}
