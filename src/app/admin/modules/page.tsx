import { redirect } from 'next/navigation';

/** Module access is configured per company on each company detail page. */
export default function AdminModulesRedirectPage() {
  redirect('/admin/companies');
}
