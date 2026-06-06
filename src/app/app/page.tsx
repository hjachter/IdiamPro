import OutlinePro from '@/components/outline-pro';
import ErrorBoundary from '@/components/error-boundary';
import AppErrorBoundary from '@/components/app-error-boundary';
import UpdateBanner from '@/components/update-banner';

export default function AppPage() {
  return (
    <AppErrorBoundary>
      <main className="h-full flex flex-col">
        {/* Auto-updater banner — only renders inside the Electron desktop app
            after an update has been downloaded. No-ops on web / iOS. */}
        <UpdateBanner />
        <div className="flex-1 min-h-0">
          <ErrorBoundary>
            <OutlinePro />
          </ErrorBoundary>
        </div>
      </main>
    </AppErrorBoundary>
  );
}
