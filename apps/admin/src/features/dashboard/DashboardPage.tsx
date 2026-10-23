import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Hourglass,
  Wallet,
  Undo2,
  UserX,
} from 'lucide-react';
import { Link } from 'react-router';
import { useApi } from '@/api/api-provider';
import { unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { AreaChart, Donut } from '@/components/charts/charts';
import { compactRupees } from '@/components/charts/scale';
import { ErrorNote, Loading, PageHeader } from '@/components/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { fillDays, shortDay } from '@/lib/days';
import { formatDateTime, formatPaise } from '@/lib/format';

const TREND_DAYS = 14;

export function DashboardPage() {
  const { me, can } = useAuth();
  const greeting = me?.user.displayName ?? me?.user.email ?? 'there';

  return (
    <div className="grid max-w-6xl gap-6">
      <PageHeader
        title={`Welcome, ${greeting}`}
        description="How the business is doing right now."
      />
      {can('bookings:read') ? (
        <Numbers />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nothing to show yet</CardTitle>
            <CardDescription>
              Your role does not include viewing bookings. Use the menu to open the sections you
              have access to.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

/** The last two weeks of money taken — decoration for people who may read reports, silent when it is unavailable. */
function Trend() {
  const api = useApi();
  const { can } = useAuth();
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - (TREND_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const query = useQuery({
    queryKey: ['dashboard-trend', from, to],
    enabled: can('reports:read'),
    retry: false,
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/admin/reports/summary', {
          params: {
            query: {
              from: `${from}T00:00:00.000Z`,
              to: new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString(),
            },
          },
        }),
      ),
  });
  if (!query.data) return null;
  const days = fillDays(query.data.days, from, to, (day) => ({
    day,
    bookings: 0,
    collectedPaise: 0,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Money taken, last {TREND_DAYS} days</CardTitle>
        <CardDescription>
          {formatPaise(query.data.totals.netPaise)} net of refunds · {query.data.totals.bookings}{' '}
          bookings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AreaChart
          title={`Money taken per day, last ${TREND_DAYS} days`}
          data={days.map((d) => ({ label: shortDay(d.day), value: d.collectedPaise }))}
          format={formatPaise}
          axisFormat={compactRupees}
        />
      </CardContent>
    </Card>
  );
}

function Numbers() {
  const api = useApi();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => unwrap(await api.GET('/v1/admin/dashboard')),
    refetchInterval: 30_000,
  });

  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} />;
  const d = query.data;
  const liveTotal = d.now.held + d.now.confirmed + d.now.active + d.now.overdue;

  return (
    <>
      <section aria-labelledby="live-heading" className="grid gap-3">
        <h3 id="live-heading" className="text-sm font-medium text-muted-foreground">
          Right now
        </h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <dl className="grid grid-cols-2 gap-3 lg:col-span-2">
            <StatCard
              label="Unpaid holds"
              value={d.now.held}
              hint="Slots kept while the customer pays"
              icon={Hourglass}
              tone="amber"
            />
            <StatCard
              label="Confirmed"
              value={d.now.confirmed}
              hint="Paid, waiting to be collected"
              icon={CalendarCheck}
              tone="primary"
            />
            <StatCard
              label="Out on rental"
              value={d.now.active}
              hint="Handed over, not returned yet"
              icon={CheckCircle2}
              tone="green"
            />
            <StatCard
              label="Overdue"
              value={d.now.overdue}
              hint="Past the end time"
              icon={Clock}
              tone="rose"
            />
          </dl>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bookings in flight</CardTitle>
            </CardHeader>
            <CardContent>
              <Donut
                title="Bookings in flight by state"
                centerLabel="in flight"
                size={140}
                slices={[
                  { label: 'Unpaid', value: d.now.held, color: 'var(--chart-3)' },
                  { label: 'Booked', value: d.now.confirmed, color: 'var(--chart-1)' },
                  { label: 'Out now', value: d.now.active, color: 'var(--chart-5)' },
                  { label: 'Late', value: d.now.overdue, color: 'var(--chart-4)' },
                ]}
              />
              {liveTotal === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Nothing is in flight.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Trend />

      <section aria-labelledby="week-heading" className="grid gap-3">
        <h3 id="week-heading" className="text-sm font-medium text-muted-foreground">
          Last {d.windowDays} days
        </h3>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Completed"
            value={d.lastDays.completed}
            icon={CheckCircle2}
            tone="green"
          />
          <StatCard label="Cancelled" value={d.lastDays.cancelled} icon={Ban} tone="rose" />
          <StatCard label="No-shows" value={d.lastDays.noShow} icon={UserX} tone="amber" />
          <StatCard
            label="Expired holds"
            value={d.lastDays.expired}
            icon={Hourglass}
            tone="primary"
          />
          <StatCard
            label="Money received"
            value={formatPaise(d.lastDays.grossPaise)}
            icon={Wallet}
            tone="teal"
          />
          <StatCard
            label="Refunded"
            value={formatPaise(d.lastDays.refundedPaise)}
            icon={Undo2}
            tone="rose"
          />
        </dl>
      </section>

      <section aria-labelledby="next-heading" className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 id="next-heading" className="text-sm font-medium text-muted-foreground">
            Next pickups
          </h3>
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            to="/bookings"
          >
            All bookings
          </Link>
        </div>
        {d.upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed bookings are waiting.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Starts</Th>
                <Th>Customer</Th>
                <Th>Item</Th>
                <Th>Drawer</Th>
              </Tr>
            </THead>
            <TBody>
              {d.upcoming.map((b) => (
                <Tr key={b.id}>
                  <Td>{formatDateTime(b.startsAt, b.drawer.timezone)}</Td>
                  <Td>{b.customer.email ?? b.customer.id}</Td>
                  <Td>
                    {b.itemModel.name}{' '}
                    <span className="text-muted-foreground">({b.assetCode})</span>
                  </Td>
                  <Td>{b.drawer.name}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </>
  );
}
