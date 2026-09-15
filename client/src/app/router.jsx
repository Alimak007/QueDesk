/* eslint-disable react-refresh/only-export-components -- route module, not hot-reloaded */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { GuestOnly, RequireAuth, RequireRole } from '@/features/auth/guards';
import { ROLES } from '@/lib/constants';
import { RouteErrorBoundary } from '@/pages/RouteErrorBoundary';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const MyLeavePage = lazy(() => import('@/features/leaves/MyLeavePage'));
const LeaveManagementPage = lazy(() => import('@/features/leaves/LeaveManagementPage'));
const MyStatusPage = lazy(() => import('@/features/daily-status/MyStatusPage'));
const StatusAdminPage = lazy(() => import('@/features/daily-status/StatusAdminPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const EmployeesPage = lazy(() => import('@/features/employees/EmployeesPage'));
const EmployeeDetailsPage = lazy(() => import('@/features/employees/EmployeeDetailsPage'));
const SalesPage = lazy(() => import('@/features/sales/SalesPage'));
const SalesConfigPage = lazy(() => import('@/features/sales-config/SalesConfigPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function Root() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <GuestOnly />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'calendar', element: <CalendarPage /> },
              { path: 'sales', element: <SalesPage /> },
              { path: 'profile', element: <ProfilePage /> },
              {
                element: <RequireRole roles={[ROLES.EMPLOYEE]} />,
                children: [
                  { path: 'my-leave', element: <MyLeavePage /> },
                  { path: 'my-status', element: <MyStatusPage /> },
                ],
              },
              {
                element: <RequireRole roles={[ROLES.ADMIN]} />,
                children: [
                  { path: 'employees', element: <EmployeesPage /> },
                  { path: 'employees/:id', element: <EmployeeDetailsPage /> },
                  { path: 'leave-management', element: <LeaveManagementPage /> },
                  { path: 'daily-status', element: <StatusAdminPage /> },
                  { path: 'sales/configuration', element: <SalesConfigPage /> },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
