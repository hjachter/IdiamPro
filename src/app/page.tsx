import OutlinePro from '@/components/outline-pro';
import ErrorBoundary from '@/components/error-boundary';

export default function Home() {
  return (
    <main className="h-full">
      <ErrorBoundary>
        <OutlinePro />
      </ErrorBoundary>
    </main>
  );
}
