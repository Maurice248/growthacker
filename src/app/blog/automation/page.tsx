'use client';

import { BlogWorkflowEditor } from '@/components/blog/BlogWorkflowEditor';
import { EditorialPage, EditorialPageHeader } from '@/components/editorial/editorial-layout';

export default function BlogAutomationPage() {
  return (
    <EditorialPage>
      <EditorialPageHeader
        eyebrow="Blog"
        title="Automation"
        subtitle="Configure schedule, AI prompts, publishing options, and blog categories for automated generation. Prompts, schedule, and categories are stored per company — leave prompt fields empty to use smart defaults built from your brand config."
      />

      <BlogWorkflowEditor />

      <div className="mt-14 text-xs text-[#B0A88F]">version 0.2</div>
    </EditorialPage>
  );
}
