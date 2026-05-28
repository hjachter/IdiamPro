import OutlinePro from '@/components/outline-pro';
import ErrorBoundary from '@/components/error-boundary';
import AppErrorBoundary from '@/components/app-error-boundary';

export default function AppPage() {
  return (
    <AppErrorBoundary>
      <main className="h-full">
        <ErrorBoundary>
          <OutlinePro />
        </ErrorBoundary>
      </main>
    </AppErrorBoundary>
  );
}
