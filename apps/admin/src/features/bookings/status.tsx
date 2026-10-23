import { Badge, type Tone } from '@/components/ui/badge';
import { humanize } from '@/lib/format';

const TONES: Record<string, Tone> = {
  held: 'warning',
  confirmed: 'info',
  active: 'success',
  overdue: 'danger',
  completed: 'neutral',
  cancelled: 'neutral',
  expired: 'neutral',
  no_show: 'danger',
};

const LABELS: Record<string, string> = { held: 'Awaiting payment', active: 'Out on rental' };

export const STATUS_OPTIONS = [
  'held',
  'confirmed',
  'active',
  'overdue',
  'completed',
  'cancelled',
  'expired',
  'no_show',
] as const;

export const statusLabel = (status: string): string => LABELS[status] ?? humanize(status);

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONES[status] ?? 'neutral'}>{statusLabel(status)}</Badge>;
}
