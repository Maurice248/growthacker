'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Eye, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { startImpersonating } from '@/lib/admin-impersonate';

type ViewAsCompanyButtonProps = {
  companyId: string;
  companyName: string;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline' | 'ghost';
};

export function ViewAsCompanyButton({
  companyId,
  companyName,
  size = 'sm',
  variant = 'outline',
}: ViewAsCompanyButtonProps) {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const ok = await startImpersonating(update, companyId);
      if (ok) {
        router.push('/client-dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={loading}
      onClick={handleClick}
      title={`View as ${companyName}`}
      className="gap-1.5"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
      View as
    </Button>
  );
}
