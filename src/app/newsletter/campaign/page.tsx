import CreateCampaign from '@/components/newsletter/CreateCampaign';
import { EditorialPageHeader } from '@/components/editorial/editorial-layout';

export const metadata = { title: 'Create Campaign' };

export default function CampaignPage() {
  return (
    <div>
      <EditorialPageHeader
        eyebrow="Newsletter"
        title="Create Campaign"
        subtitle="Configure and launch your newsletter campaign."
        className="mb-10"
      />
      <CreateCampaign />
    </div>
  );
}
