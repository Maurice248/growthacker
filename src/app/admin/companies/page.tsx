import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CompaniesTable } from '@/components/admin/companies-table';

export default function AdminCompaniesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <AdminPageHeader
        title="Companies"
        description="All registered companies, integration status, and member counts."
      />
      <CompaniesTable />
    </div>
  );
}
