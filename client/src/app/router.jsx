/* eslint-disable react-refresh/only-export-components -- route module, not hot-reloaded */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { FullPageLoader } from '@/components/layout/FullPageLoader';
import { GuestOnly, RedirectTo, RequireAdmin, RequireAuth, RequirePermission } from '@/features/auth/guards';
import { RouteErrorBoundary } from '@/pages/RouteErrorBoundary';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const LeavePage = lazy(() => import('@/features/leaves/LeavePage'));
const DailyStatusPage = lazy(() => import('@/features/daily-status/DailyStatusPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const EmployeesPage = lazy(() => import('@/features/employees/EmployeesPage'));
const EmployeeDetailsPage = lazy(() => import('@/features/employees/EmployeeDetailsPage'));
const LeadsPage = lazy(() => import('@/features/sales/SalesPage'));
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage'));
const PayslipsPage = lazy(() => import('@/features/payslips/PayslipsPage'));
const PayslipEditorPage = lazy(() => import('@/features/payslips/PayslipEditorPage'));
const PayslipViewPage = lazy(() => import('@/features/payslips/PayslipViewPage'));
const InvoicesPage = lazy(() => import('@/features/invoices/InvoicesPage'));
const InvoiceEditorPage = lazy(() => import('@/features/invoices/InvoiceEditorPage'));
const InvoiceViewPage = lazy(() => import('@/features/invoices/InvoiceViewPage'));
const PermissionsPage = lazy(() => import('@/features/permissions/PermissionsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const CompanyEditorPage = lazy(() => import('@/features/settings/CompanyEditorPage'));
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
              { path: 'profile', element: <ProfilePage /> },

              /* CRM */
              {
                element: <RequirePermission module="leads" />,
                children: [{ path: 'leads', element: <LeadsPage /> }],
              },
              {
                element: <RequirePermission module="customers" />,
                children: [{ path: 'customers', element: <CustomersPage /> }],
              },

              /* HR */
              {
                element: <RequirePermission module="employees" />,
                children: [
                  { path: 'employees', element: <EmployeesPage /> },
                  { path: 'employees/:id', element: <EmployeeDetailsPage /> },
                ],
              },
              {
                element: <RequirePermission module="leave" />,
                children: [{ path: 'leave', element: <LeavePage /> }],
              },
              {
                element: <RequirePermission module="dailyStatus" />,
                children: [{ path: 'daily-status', element: <DailyStatusPage /> }],
              },
              {
                element: <RequirePermission module="payslips" />,
                children: [
                  { path: 'payslips', element: <PayslipsPage /> },
                  { path: 'payslips/new', element: <PayslipEditorPage /> },
                  { path: 'payslips/:id', element: <PayslipViewPage /> },
                  { path: 'payslips/:id/edit', element: <PayslipEditorPage /> },
                ],
              },

              /* Finance */
              {
                element: <RequirePermission module="invoices" />,
                children: [
                  { path: 'invoices', element: <InvoicesPage /> },
                  { path: 'invoices/new', element: <InvoiceEditorPage /> },
                  { path: 'invoices/:id', element: <InvoiceViewPage /> },
                  { path: 'invoices/:id/edit', element: <InvoiceEditorPage /> },
                ],
              },

              /* Calendar */
              {
                element: <RequirePermission module="calendar" />,
                children: [{ path: 'calendar', element: <CalendarPage /> }],
              },

              /* Administration */
              {
                element: <RequireAdmin />,
                children: [
                  { path: 'permissions', element: <PermissionsPage /> },
                  { path: 'settings', element: <SettingsPage /> },
                  { path: 'settings/companies/new', element: <CompanyEditorPage /> },
                  { path: 'settings/companies/:id', element: <CompanyEditorPage /> },
                ],
              },

              /* Routes from the previous navigation */
              { path: 'my-leave', element: <RedirectTo to="/leave" /> },
              { path: 'leave-management', element: <RedirectTo to="/leave" /> },
              { path: 'my-status', element: <RedirectTo to="/daily-status" /> },
              { path: 'sales', element: <RedirectTo to="/leads" /> },
              { path: 'sales/configuration', element: <RedirectTo to="/settings?tab=lead-form" /> },

              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
