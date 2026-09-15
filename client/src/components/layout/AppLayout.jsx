import * as Dialog from '@radix-ui/react-dialog';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import { PageLoader } from './FullPageLoader';
import { SidebarContent, Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>

      <Sidebar />

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 data-[state=open]:animate-fade-in lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-pop focus:outline-none data-[state=open]:animate-slide-in-left lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Main navigation menu</Dialog.Description>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="lg:pl-64">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
