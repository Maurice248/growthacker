import GenerateNewsletter from '@/components/newsletter/GenerateNewsletter';
import { EditorialPageHeader } from '@/components/editorial/editorial-layout';

export const metadata = { title: 'Generate Newsletter' };

export default function GeneratePage() {
  return (
    <div>
      <EditorialPageHeader
        eyebrow="Newsletter"
        title="Generate Newsletter"
        subtitle="Select a service and enter a topic to generate your newsletter."
        className="mb-10"
      />
      <GenerateNewsletter />
    </div>
  );
}
