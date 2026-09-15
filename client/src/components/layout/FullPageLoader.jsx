import { Spinner } from '@/components/ui';
import { Logo } from './Logo';

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas">
      <Logo size="lg" />
      <Spinner size={22} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size={24} />
    </div>
  );
}
