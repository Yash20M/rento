import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useApi } from '@/api/api-provider';
import { fieldErrors, unwrap } from '@/api/errors';
import { useAuth } from '@/auth/auth-context';
import { ErrorNote, Loading, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/controls';
import { formatDuration } from '@/lib/format';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{children}</dd>
    </div>
  );
}

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

/** The one group of rules an operator may change without a deployment: which drawers a customer is offered. */
function NearbyCard({ radiusMeters, maxResults }: { radiusMeters: number; maxResults: number }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [radiusKm, setRadiusKm] = useState(String(radiusMeters / 1000));
  const [count, setCount] = useState(String(maxResults));
  const km = Number(radiusKm);
  const results = Number(count);
  const valid =
    Number.isFinite(km) &&
    km >= 0.1 &&
    km <= 50 &&
    Number.isInteger(km * 1000) &&
    Number.isInteger(results) &&
    results >= 1 &&
    results <= 10;
  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.PUT('/v1/admin/settings/discovery', {
          body: { radiusMeters: Math.round(km * 1000), maxResults: results },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
  const problems = fieldErrors(save.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) save.mutate();
  };
  return (
    <Card className="p-4">
      <h3 className="mb-1 font-medium">Nearby search</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Which drawers a customer is offered. A change applies to the very next search.
      </p>
      <form className="grid gap-3" noValidate onSubmit={submit} aria-label="Nearby search">
        <TextField
          label="Search radius (km)"
          hint="0.1 to 50"
          type="number"
          step="0.1"
          value={radiusKm}
          error={problems['radiusMeters']}
          onChange={(e) => setRadiusKm(e.target.value)}
        />
        <TextField
          label="Drawers shown at most"
          hint="1 to 10"
          type="number"
          value={count}
          error={problems['maxResults']}
          onChange={(e) => setCount(e.target.value)}
        />
        <ErrorNote
          error={save.error && Object.keys(problems).length === 0 ? save.error : undefined}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!valid || save.isPending}>
            Save
          </Button>
          {save.isSuccess && (
            <span role="status" className="text-sm text-muted-foreground">
              Saved
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

/** The rules the platform runs with. They come from the deployment, so this page is read-only. */
export function SettingsPage() {
  const api = useApi();
  const { can } = useAuth();
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => unwrap(await api.GET('/v1/admin/settings')),
  });
  const s = query.data;

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Settings"
        description="The rules in force right now. Most are set when the platform is deployed; the nearby-search rules can be changed here."
      />
      {query.isPending && <Loading />}
      {query.isError && <ErrorNote error={query.error} onRetry={() => void query.refetch()} />}
      {s && (
        <>
          {s.paymentDemoMode && (
            <p
              role="status"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
            >
              <strong>Demo payments.</strong> No real money moves: customers pay with a test
              checkout. Real payments need the Razorpay keys.
            </p>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-1 font-medium">Booking</h3>
              <dl className="divide-y">
                <Row label="Slot is held for">{formatDuration(s.holdMinutes)}</Row>
                <Row label="Earliest start">{formatDuration(s.bookingMinLeadMinutes)} from now</Row>
                <Row label="Furthest ahead">{s.bookingMaxAdvanceDays} days</Row>
                <Row label="Hand-over opens">
                  {formatDuration(s.pickupEarlyMinutes)} before the start
                </Row>
                <Row label="No-show after">
                  {formatDuration(s.noShowGraceMinutes)} past the start
                </Row>
              </dl>
            </Card>
            <Card className="p-4">
              <h3 className="mb-1 font-medium">Cancellation refunds</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Share of the rental price returned (the deposit is always returned in full).
              </p>
              <ul aria-label="Refund tiers" className="divide-y text-sm">
                {[...s.refundTiers]
                  .sort((a, b) => b.minutesBeforeStart - a.minutesBeforeStart)
                  .map((t) => (
                    <li key={t.minutesBeforeStart} className="flex justify-between py-2">
                      <span>
                        {t.minutesBeforeStart === 0
                          ? 'Any later cancellation'
                          : `At least ${formatDuration(t.minutesBeforeStart)} before the start`}
                      </span>
                      <strong>{t.percent}%</strong>
                    </li>
                  ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h3 className="mb-1 font-medium">Customers</h3>
              <dl className="divide-y">
                <Row label="Aadhaar verification required">{yesNo(s.kycRequired)}</Row>
                <Row label="Nearby search radius">
                  {s.discoveryRadiusMeters / 1000} km, up to {s.discoveryMaxResults} drawers
                </Row>
              </dl>
            </Card>
            {can('settings:write') && (
              <NearbyCard
                radiusMeters={s.discoveryRadiusMeters}
                maxResults={s.discoveryMaxResults}
              />
            )}
            <Card className="p-4">
              <h3 className="mb-1 font-medium">Payments and background work</h3>
              <dl className="divide-y">
                <Row label="Gateway">{s.paymentDemoMode ? 'Demo gateway' : 'Razorpay'}</Row>
                {!s.paymentDemoMode && (
                  <Row label="Webhook secret set">{yesNo(s.webhookConfigured)}</Row>
                )}
                <Row label="Background sweeps">
                  {s.jobsIntervalSeconds === 0 ? 'Off' : `Every ${s.jobsIntervalSeconds} seconds`}
                </Row>
              </dl>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
