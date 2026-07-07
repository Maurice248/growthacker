import { Badge } from '@/components/ui/badge';
import {
  APP_ADMIN_ROLE,
  COMPANY_ADMIN_ROLE,
  COMPANY_MEMBER_ROLE,
  LEGACY_ADMIN_ROLE,
  LEGACY_CLIENT_ROLE,
} from '@/lib/auth';

export function roleLabel(role: string): string {
  switch (role) {
    case APP_ADMIN_ROLE:
      return 'Platform Admin';
    case COMPANY_ADMIN_ROLE:
    case LEGACY_ADMIN_ROLE:
      return 'Company Admin';
    case COMPANY_MEMBER_ROLE:
    case LEGACY_CLIENT_ROLE:
      return 'Member';
    default:
      return role;
  }
}

export function RoleBadge({ role }: { role: string }) {
  const variant =
    role === APP_ADMIN_ROLE
      ? 'default'
      : role === COMPANY_ADMIN_ROLE || role === LEGACY_ADMIN_ROLE
        ? 'secondary'
        : 'outline';

  return <Badge variant={variant}>{roleLabel(role)}</Badge>;
}
