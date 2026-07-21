import { Header } from '@/components/dashboard/header';
import { PageBody } from '@/components/outreach/page-body';
import { CleanupStatus } from '@/components/cleanup/cleanup-status';
import { CleanupHistory } from '@/components/cleanup/cleanup-history';

export default function CleanupPage() {
  return (
    <div>
      <Header
        title="Contact Cleanup"
        description="Automatically remove old contacts from Instantly.ai every 10 days."
      />
      <PageBody>
        <CleanupStatus />
        <CleanupHistory />
      </PageBody>
    </div>
  );
}
