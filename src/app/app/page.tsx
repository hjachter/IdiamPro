import OutlinePro from '@/components/outline-pro';
import ErrorBoundary from '@/components/error-boundary';

export default function AppPage() {
  return (
    <AppErrorBoundary>\n      <main className="h-full">
      <ErrorBoundary>
        <OutlinePro />
      </ErrorBoundary>
    </main>
  \n    </AppErrorBoundary>);
}
\nimport AppErrorBoundary from '@/components/app-error-boundary';