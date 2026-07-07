import { CompanyDetailPanel } from '@/components/admin/company-detail-panel';

export default async function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CompanyDetailPanel companyId={id} />;
}
