'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Home, Loader2 } from 'lucide-react';
import {
  EditorialDefinitionList,
  EditorialDefinitionRow,
  EditorialField,
} from '@/app/components';
import { editorialPillButtonClass } from '@/components/editorial/editorial-layout';

type CompanyProfile = {
  name: string;
  logoUrl: string | null;
  slug: string;
};

async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const res = await fetch('/api/companies/upload-logo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, contentType: file.type }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Logo upload failed');
  }

  const uploadRes = await fetch(data.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || data.contentType },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload logo file');
  }

  return data.publicUrl as string;
}

export function CompanyProfileForm({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [name, setName] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/companies/profile');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load company profile');
      setProfile(data);
      setName(data.name);
      setLogoPreview(data.logoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be smaller than 2 MB.');
      return;
    }

    setError(null);
    setSuccess(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      let logoUrl: string | null | undefined;

      if (logoFile) {
        logoUrl = await uploadLogo(logoFile);
      }

      const payload: { name: string; logoUrl?: string | null } = { name: name.trim() };
      if (logoUrl !== undefined) {
        payload.logoUrl = logoUrl;
      }

      const res = await fetch('/api/companies/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save company profile');

      setProfile(data);
      setName(data.name);
      setLogoPreview(data.logoUrl);
      setLogoFile(null);
      setSuccess('Company profile saved.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading company profile…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {readOnly && (
        <div className="mb-4 text-sm text-[var(--text-muted)]">
          Only company admins can edit company profile settings.
        </div>
      )}

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

      <fieldset disabled={readOnly} className="disabled:opacity-80">
        <EditorialDefinitionList>
          <EditorialDefinitionRow label="Company name">
            <EditorialField
              value={name}
              onChange={setName}
              style={{ maxWidth: 420 }}
            />
          </EditorialDefinitionRow>

          <EditorialDefinitionRow label="Company logo">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#C2B79A] text-[var(--text-muted)]">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-1" />
                ) : (
                  <Home className="h-5 w-5" strokeWidth={1.8} />
                )}
              </div>
              {!readOnly && (
                <label className="cursor-pointer text-sm font-bold text-[var(--primary)] underline decoration-[#C2B79A] underline-offset-4 transition-colors hover:text-[var(--red)] hover:decoration-[var(--red)]">
                  Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
              )}
            </div>
          </EditorialDefinitionRow>

          {profile?.slug && (
            <EditorialDefinitionRow label="Workspace ID" isLast>
              <div className="text-[15px] text-[var(--text-muted)]">{profile.slug}</div>
            </EditorialDefinitionRow>
          )}
        </EditorialDefinitionList>

        {!readOnly && (
          <footer className="mt-5 flex flex-wrap items-baseline gap-4 border-t border-[var(--border)] pt-5">
            <span className="text-[13.5px] text-[var(--text-muted)]">
              Changes apply across the whole workspace.
            </span>
            <button
              type="submit"
              disabled={saving}
              className={editorialPillButtonClass}
              style={{ marginLeft: 'auto' }}
            >
              {saving ? 'Saving…' : 'Save company profile'}
            </button>
          </footer>
        )}
      </fieldset>
    </form>
  );
}
