'use client';

import { BlogWorkflowEditor } from '@/components/blog/BlogWorkflowEditor';

export default function BlogAutomationPage() {
  return (
    <div>
      <div className="flex items-start justify-between gap-6 px-8 pb-4 pt-8">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-gray-900">Automation</h1>
          <p className="mt-1 text-[15px] text-gray-500">
            Configure schedule, AI prompts, publishing options, and blog categories for automated
            generation
          </p>
        </div>
      </div>

      <div className="px-8 pb-8">
        <BlogWorkflowEditor />
      </div>
    </div>
  );
}
