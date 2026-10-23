import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useApi } from '@/api/api-provider';
import { unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { AreaChart, BarChart, BarList, Donut } from '@/components/charts/charts';
import { compactRupees } from '@/components/charts/scale';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/page';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, TextField } from '@/components/ui/controls';
import { StatCard } from '@/components/ui/stat';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/table';
import { fillDays, shortDay } from '@/lib/days';
import { formatPaise } from '@/lib/format';

const DAY_MS = 86_400_000;
const isoDay = (at: Date) => at.toISOString().slice(0, 10);

/** Bookings confirmed in a period: how many, how long they were rented and the money taken (README §13.1). */
export function ReportsPage() {
  const api = useApi();
  const { can } = useAuth();
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 29 * DAY_MS)));
  const [to, setTo] = useState(isoDay(today));
  const [drawerId, setDrawerId] = useState('');

  const drawers = useQuery({
    queryKey: ['drawers'],
    enabled: can('drawers:read'),
    queryFn: async () => unwrap(await api.GET('/v1/admin/drawers')),
  });

  const validRange =
    /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  // Whole days, inclusive of the last one.
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = new Date(Date.parse(`${to}T00:00:00.000Z`) + DAY_MS).toISOString();

  const report = useQuery({
    queryKey: ['report', fromIso, toIso, drawerId],
    enabled: validRange,
    queryFn: async () =>
      unwrap(
        await api.GET('/v1/admin/reports/summary', {
          params: {
            query: { from: fromIso, to: toIso, ...(drawerId !== '' && { drawerId }) },
          },
        }),
      ),
  });
  const data = report.data;
  const days = data
    ? fillDays(data.days, from, to, (day) => ({ day, bookings: 0, collectedPaise: 0 }))
    : [];
  const other = data
    ? Math.max(
        0,
        data.totals.bookings - data.totals.completed - data.totals.cancelled - data.totals.noShow,
      )
    : 0;

  return (
    <div className="grid max-w-6xl gap-5">
      <PageHeader
        title="Reports"
        description="Bookings paid for in the chosen days. Money is what was taken minus what was (or will be) refunded; it includes refundable deposits, so it is not profit."
      />
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <TextField
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="grid gap-1.5">
          <label htmlFor="report-drawer" className="text-sm font-medium">
            Drawer
          </label>
          <Select id="report-drawer" value={drawerId} onChange={(e) => setDrawerId(e.target.value)}>
            <option value="">All my drawers</option>
            {drawers.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {!validRange && (
        <p role="alert" className="text-sm text-destructive">
          Pick a start day that is not after the end day.
        </p>
      )}
      {report.isPending && validRange && <Loading />}
      {report.isError && <ErrorNote error={report.error} onRetry={() => void report.refetch()} />}

      {data && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
            <StatCard label="Bookings" value={String(data.totals.bookings)} icon={CalendarCheck} />
            <StatCard
              label="Completed / cancelled / no-show"
              value={`${data.totals.completed} / ${data.totals.cancelled} / ${data.totals.noShow}`}
              icon={CheckCircle2}
              tone="green"
            />
            <StatCard
              label="Hours rented"
              value={String(data.totals.rentedHours)}
              icon={Clock}
              tone="amber"
            />
            <StatCard
              label="Net money"
              value={formatPaise(data.totals.netPaise)}
              hint={`${formatPaise(data.totals.collectedPaise)} taken − ${formatPaise(data.totals.refundedPaise)} refunded`}
              icon={Wallet}
              tone="teal"
            />
          </dl>

          {data.totals.bookings === 0 ? (
            <EmptyState title="No bookings were paid for in this period" />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Money taken per day</CardTitle>
                    <CardDescription>
                      Rental, deposits and extensions, before refunds.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AreaChart
                      title="Money taken per day"
                      data={days.map((d) => ({ label: shortDay(d.day), value: d.collectedPaise }))}
                      format={formatPaise}
                      axisFormat={compactRupees}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Bookings per day</CardTitle>
                    <CardDescription>Counted on the day they were paid for.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarChart
                      title="Bookings per day"
                      color="var(--chart-2)"
                      data={days.map((d) => ({ label: shortDay(d.day), value: d.bookings }))}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">How they ended</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Donut
                      title="Booking outcomes"
                      centerLabel="bookings"
                      slices={[
                        {
                          label: 'Completed',
                          value: data.totals.completed,
                          color: 'var(--chart-5)',
                        },
                        {
                          label: 'Cancelled',
                          value: data.totals.cancelled,
                          color: 'var(--chart-4)',
                        },
                        { label: 'No-show', value: data.totals.noShow, color: 'var(--chart-3)' },
                        { label: 'Upcoming or running', value: other, color: 'var(--chart-1)' },
                      ]}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">By drawer</CardTitle>
                    <CardDescription>Money taken</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarList
                      title="Money by drawer"
                      format={formatPaise}
                      rows={data.drawers.map((r) => ({
                        label: r.name,
                        value: r.collectedPaise,
                        hint: `${r.bookings} bookings · ${r.rentedHours} h`,
                      }))}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">By item model</CardTitle>
                    <CardDescription>Money taken</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BarList
                      title="Money by item model"
                      color="var(--chart-2)"
                      format={formatPaise}
                      rows={data.models.map((r) => ({
                        label: r.name,
                        value: r.collectedPaise,
                        hint: `${r.bookings} bookings · ${r.rentedHours} h`,
                      }))}
                    />
                  </CardContent>
                </Card>
              </div>

              <details className="rounded-2xl border bg-card p-4 shadow-card">
                <summary className="cursor-pointer text-sm font-medium">
                  See the numbers as tables
                </summary>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <Table aria-label="By day">
                    <THead>
                      <Tr>
                        <Th>Day</Th>
                        <Th className="text-right">Bookings</Th>
                        <Th className="text-right">Taken</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {data.days.map((d) => (
                        <Tr key={d.day}>
                          <Td>{d.day}</Td>
                          <Td className="text-right tabular-nums">{d.bookings}</Td>
                          <Td className="text-right tabular-nums">
                            {formatPaise(d.collectedPaise)}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                  <GroupTable label="By drawer" rows={data.drawers} />
                  <div className="xl:col-span-2">
                    <GroupTable label="By item model" rows={data.models} />
                  </div>
                </div>
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}

function GroupTable({
  label,
  rows,
}: {
  label: string;
  rows: Array<{
    id: string;
    name: string;
    bookings: number;
    rentedHours: number;
    collectedPaise: number;
  }>;
}) {
  return (
    <Table aria-label={label}>
      <THead>
        <Tr>
          <Th>Name</Th>
          <Th className="text-right">Bookings</Th>
          <Th className="text-right">Hours</Th>
          <Th className="text-right">Taken</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td className="font-medium">{r.name}</Td>
            <Td className="text-right tabular-nums">{r.bookings}</Td>
            <Td className="text-right tabular-nums">{r.rentedHours}</Td>
            <Td className="text-right tabular-nums">{formatPaise(r.collectedPaise)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
