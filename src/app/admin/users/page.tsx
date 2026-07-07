import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminUsersTable } from '@/components/admin/admin-users-table';

export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader
        title="Users"
        description="All platform users, their roles, and company assignments."
      />
      <AdminUsersTable />
    </div>
  );
}
