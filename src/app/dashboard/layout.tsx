import { Sidebar } from '@/components/dashboard/sidebar';
import { AppSectionProvider } from '@/lib/app-section';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppSectionProvider section="dashboard">
      <div className="flex h-screen overflow-hidden bg-[var(--background)]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="editorial-shell-main editorial-shell-gutter flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </AppSectionProvider>
  );
}
