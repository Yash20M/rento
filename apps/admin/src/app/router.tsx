import { lazy } from 'react';
import { type RouteObject, createBrowserRouter } from 'react-router';
import { NotFoundPage } from '@/components/NotFoundPage';
import { AcceptInvitationPage } from '@/features/auth/AcceptInvitationPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequirePermission } from './guards';

// Each page is its own download, fetched when first opened: the first screen stays small.
const AccountPage = lazy(() =>
  import('@/features/account/AccountPage').then((m) => ({ default: m.AccountPage })),
);
const AssetsPage = lazy(() =>
  import('@/features/inventory/AssetsPage').then((m) => ({ default: m.AssetsPage })),
);
const AuditPage = lazy(() =>
  import('@/features/audit/AuditPage').then((m) => ({ default: m.AuditPage })),
);
const BookingsPage = lazy(() =>
  import('@/features/bookings/BookingsPage').then((m) => ({ default: m.BookingsPage })),
);
const CategoriesPage = lazy(() =>
  import('@/features/inventory/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
);
const CustomersPage = lazy(() =>
  import('@/features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })),
);
const DrawersPage = lazy(() =>
  import('@/features/drawers/DrawersPage').then((m) => ({ default: m.DrawersPage })),
);
const PromotionsPage = lazy(() =>
  import('@/features/inventory/PromotionsPage').then((m) => ({ default: m.PromotionsPage })),
);
const ItemModelsPage = lazy(() =>
  import('@/features/inventory/ItemModelsPage').then((m) => ({ default: m.ItemModelsPage })),
);
const PaymentsPage = lazy(() =>
  import('@/features/reports/PaymentsPage').then((m) => ({ default: m.PaymentsPage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const RolesPage = lazy(() =>
  import('@/features/access/RolesPage').then((m) => ({ default: m.RolesPage })),
);
const SchedulePage = lazy(() =>
  import('@/features/schedule/SchedulePage').then((m) => ({ default: m.SchedulePage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const StaffPage = lazy(() =>
  import('@/features/access/StaffPage').then((m) => ({ default: m.StaffPage })),
);

/** Route table. The permission on each page only hides it — the API refuses the calls regardless (README §13.5). */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/accept-invitation', element: <AcceptInvitationPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'account', element: <AccountPage /> },
          {
            path: 'bookings',
            element: (
              <RequirePermission permission="bookings:read">
                <BookingsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'schedule',
            element: (
              <RequirePermission permission="bookings:read">
                <SchedulePage />
              </RequirePermission>
            ),
          },
          {
            path: 'customers',
            element: (
              <RequirePermission permission="users:read">
                <CustomersPage />
              </RequirePermission>
            ),
          },
          {
            path: 'inventory/categories',
            element: (
              <RequirePermission permission="inventory:read">
                <CategoriesPage />
              </RequirePermission>
            ),
          },
          {
            path: 'inventory/models',
            element: (
              <RequirePermission permission="inventory:read">
                <ItemModelsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'offers',
            element: (
              <RequirePermission permission="inventory:read">
                <PromotionsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'inventory/assets',
            element: (
              <RequirePermission permission="assets:read">
                <AssetsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'drawers',
            element: (
              <RequirePermission permission="drawers:read">
                <DrawersPage />
              </RequirePermission>
            ),
          },
          {
            path: 'staff',
            element: (
              <RequirePermission permission="admins:read">
                <StaffPage />
              </RequirePermission>
            ),
          },
          {
            path: 'roles',
            element: (
              <RequirePermission permission="roles:read">
                <RolesPage />
              </RequirePermission>
            ),
          },
          {
            path: 'reports',
            element: (
              <RequirePermission permission="reports:read">
                <ReportsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'payments',
            element: (
              <RequirePermission permission="reports:read">
                <PaymentsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'settings',
            element: (
              <RequirePermission permission="settings:read">
                <SettingsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'audit',
            element: (
              <RequirePermission permission="audit:read">
                <AuditPage />
              </RequirePermission>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export const createAppRouter = () => createBrowserRouter(routes);
