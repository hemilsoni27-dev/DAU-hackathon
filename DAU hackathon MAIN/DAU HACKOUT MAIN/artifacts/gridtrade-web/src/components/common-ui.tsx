import { type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Activity, CircleAlert, CircleCheck, CircleDashed, RefreshCw, ShieldCheck, UserRound, LayoutDashboard } from 'lucide-react';
import { getRoleBadgeClass, updateAuthToken } from '@/context/auth-context';

export type IconType = typeof LayoutDashboard;

export function formatNumber(value: number | undefined, digits = 1) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value)
    : '—';
}

export function formatCurrency(value: number | undefined) {
  return typeof value === 'number' ? `₹${value.toFixed(2)}` : '—';
}

export function formatWhen(value?: string) {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(date);
}

export function ensureArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (val && typeof val === 'object' && 'data' in val && Array.isArray((val as any).data)) {
    return (val as any).data as T[];
  }
  return [];
}

export function decisionTone(decision?: string) {
  if (decision === 'APPROVED') return 'approved';
  if (decision === 'RESTRICTED') return 'restricted';
  return 'adjusted';
}

export function AccessDeniedPage({ requiredRole, currentRole }: { requiredRole: string; currentRole: string }) {
  const [, setLocation] = useLocation();

  const handleSwitchToRequiredRole = () => {
    const tokenMap: Record<string, string> = {
      ADMIN: 'demo:admin',
      UTILITY: 'demo:utility',
      REGULATOR: 'demo:regulator',
      PROSUMER: 'demo:prosumer',
      CONSUMER: 'demo:consumer',
    };
    const targetToken = tokenMap[requiredRole] || 'demo:admin';
    updateAuthToken(targetToken);
  };

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 text-center space-y-6 animate-in fade-in duration-200" data-testid="access-denied-page">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-xl">
        <ShieldCheck size={40} />
      </div>

      <div className="space-y-2">
        <div className="gt-label text-rose-400 uppercase tracking-widest font-mono">403 Restricted Access Control</div>
        <h1 className="text-3xl font-black tracking-tight">{requiredRole} Authorization Required</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          This portal contains restricted operational controls reserved strictly for <span className="font-extrabold text-foreground">{requiredRole}</span> role sessions.
        </p>
      </div>

      <div className="gt-card p-5 border border-rose-500/30 bg-rose-500/5 max-w-md mx-auto space-y-3 text-left">
        <div className="flex items-center justify-between text-xs border-b border-[hsl(var(--border))] pb-2">
          <span className="text-muted-foreground font-bold">Your Active Role:</span>
          <span className={`gt-badge text-[10px] font-mono font-bold px-2 py-0.5 border ${getRoleBadgeClass(currentRole)}`}>
            {currentRole}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-bold">Required Portal Role:</span>
          <span className={`gt-badge text-[10px] font-mono font-bold px-2 py-0.5 border ${getRoleBadgeClass(requiredRole)}`}>
            {requiredRole}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          onClick={handleSwitchToRequiredRole}
          className="gt-button gt-button-primary w-full sm:w-auto px-6 py-2.5 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white"
          data-testid="button-switch-required-role"
        >
          <UserRound size={15} /> Switch to {requiredRole} Persona (`demo:{requiredRole.toLowerCase()}`)
        </button>
        <button
          onClick={() => setLocation('/')}
          className="gt-button gt-button-quiet w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold"
          data-testid="button-return-home"
        >
          Return to Overview
        </button>
      </div>
    </div>
  );
}

export function DataState({ loading, error, empty, children, onRetry, label }: {
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  children: ReactNode;
  onRetry?: () => void;
  label?: string;
}) {
  if (loading) {
    return <div className="space-y-3" data-testid={`loading-${label ?? 'data'}`}>
      <div className="gt-skeleton h-24 w-full" />
      <div className="gt-skeleton h-24 w-full" />
    </div>;
  }
  if (error) {
    return <div className="gt-card flex min-h-36 flex-col items-center justify-center gap-3 p-6 text-center" data-testid={`error-${label ?? 'data'}`}>
      <CircleAlert size={19} className="text-[hsl(var(--destructive))]" />
      <div><p className="text-sm font-extrabold">Signal unavailable</p><p className="mt-1 text-xs text-muted-foreground">The latest {label ?? 'data'} could not be loaded.</p></div>
      {onRetry && <button className="gt-button gt-button-quiet" onClick={onRetry} data-testid={`button-retry-${label ?? 'data'}`}><RefreshCw size={13} /> Retry</button>}
    </div>;
  }
  if (empty) {
    return <div className="gt-card flex min-h-36 flex-col items-center justify-center p-6 text-center" data-testid={`empty-${label ?? 'data'}`}>
      <CircleDashed size={20} className="mb-2 text-muted-foreground" />
      <p className="text-sm font-extrabold">No {label ?? 'records'} yet</p>
      <p className="mt-1 text-xs text-muted-foreground">New records will appear here as the network moves.</p>
    </div>;
  }
  return <>{children}</>;
}

export function PageHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="gt-label mb-2 text-[hsl(var(--accent))]">{eyebrow}</div><h1 className="text-[26px] font-extrabold tracking-[-.055em] sm:text-[32px]">{title}</h1><p className="mt-2 max-w-[640px] text-[13px] leading-6 text-muted-foreground">{detail}</p></div>{action}</div>;
}

export function KpiCard({ label, value, sub, icon: Icon, accent = 'primary' }: { label: string; value: string; sub: string; icon: IconType; accent?: 'primary' | 'accent' }) {
  return <div className="gt-card gt-kpi p-4 sm:p-5" data-testid={`kpi-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-5 flex items-start justify-between"><span className="gt-label">{label}</span><div className={`rounded-lg p-2 ${accent === 'accent' ? 'bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))]' : 'bg-[hsl(var(--primary)/.16)] text-[hsl(var(--primary))]'}`}><Icon size={15} /></div></div><div className="gt-mono relative z-10 text-[25px] font-medium tracking-[-.06em]">{value}</div><div className="relative z-10 mt-2 text-[11px] text-muted-foreground">{sub}</div></div>;
}

export function Sparkline({ observations }: { observations: { generationKwh: number; consumptionKwh: number }[] }) {
  const points = observations.length ? observations : Array.from({ length: 8 }, (_, i) => ({ generationKwh: 20 + i * 2, consumptionKwh: 12 + i }));
  const max = Math.max(...points.flatMap((point) => [point.generationKwh, point.consumptionKwh]), 1);
  const makeLine = (key: 'generationKwh' | 'consumptionKwh') => points.map((point, index) => `${(index / Math.max(points.length - 1, 1)) * 100},${92 - (point[key] / max) * 72}`).join(' ');
  return <div className="relative h-[190px] w-full overflow-hidden rounded-lg bg-[hsl(var(--muted)/.38)] p-3" data-testid="chart-energy-trend">
    <div className="absolute inset-0 gt-grid-lines opacity-50" />
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="relative h-full w-full overflow-visible"><polyline points={makeLine('generationKwh')} fill="none" stroke="hsl(var(--accent))" strokeWidth="1.25" vectorEffect="non-scaling-stroke" /><polyline points={makeLine('consumptionKwh')} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeDasharray="3 2" /></svg>
    <div className="absolute bottom-3 left-3 flex gap-4 text-[10px] font-bold"><span className="flex items-center gap-1.5"><i className="h-1.5 w-5 rounded bg-[hsl(var(--accent))]" /> Generation</span><span className="flex items-center gap-1.5"><i className="h-1.5 w-5 rounded bg-[hsl(var(--primary))]" /> Consumption</span></div>
  </div>;
}

export function ActivityList({ events, compact = false }: { events: any[]; compact?: boolean }) {
  const list = ensureArray<any>(events);
  return <div className="divide-y divide-[hsl(var(--border))]">{list.map((event, index) => <div className={`flex gap-3 ${compact ? 'py-3' : 'py-4'}`} key={event.id ?? index} data-testid={`row-activity-${event.id ?? index}`}><div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${event.status === 'positive' ? 'bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))]' : event.status === 'warning' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary)/.14)] text-[hsl(var(--primary))]'}`}><Activity size={13} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="text-[12px] font-extrabold">{event.title}</p><span className="gt-mono text-[9px] text-muted-foreground">{formatWhen(event.occurredAt)}</span></div><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{event.detail}</p></div></div>)}</div>;
}
