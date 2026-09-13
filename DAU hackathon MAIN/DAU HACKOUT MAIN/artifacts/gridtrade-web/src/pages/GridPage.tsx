import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, ChevronRight, CircleAlert, CircleCheck, Gauge, LineChart, Radio, SunMedium } from 'lucide-react';
import { useGetEnergyOverview, useGetGridStatus, useGetMatchRecommendations } from '@workspace/api-client-react';
import { DataState, IconType, PageHeader, Sparkline, decisionTone, ensureArray, formatNumber, formatWhen } from '@/components/common-ui';

function SignalCard({ icon: Icon, label, value, detail, meter, inverse = false }: { icon: IconType; label: string; value: string; detail: string; meter?: number; inverse?: boolean }) {
  const width = Math.max(4, Math.min(100, meter ?? 0));
  return (
    <div className="gt-card p-4">
      <div className="flex items-center justify-between">
        <div className="gt-label">{label}</div>
        <Icon size={15} className="text-[hsl(var(--accent))]" />
      </div>
      <div className="gt-mono mt-6 text-[22px]">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <div className={`h-full rounded-full ${inverse ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent))]'}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function RationaleRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1.5 font-extrabold ${good ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--primary))]'}`}>
        {good ? <CircleCheck size={13} /> : <CircleAlert size={13} />}{value}
      </span>
    </div>
  );
}

export default function GridPage() {
  const grid = useGetGridStatus();
  const matches = useGetMatchRecommendations();
  const energy = useGetEnergyOverview({ window: '24h' });
  const g = grid.data;
  const matchGridList = ensureArray<any>(matches.data);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  return (
    <div className="mx-auto max-w-[1450px]">
      <PageHeader
        eyebrow="Grid conditions / decision layer"
        title="Read the grid before you act."
        detail="The local decision model balances congestion, renewable share, frequency, and match quality into one operating instruction."
        action={
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
            <span className="gt-status-dot" /> Updated {formatWhen(g?.updatedAt)}
          </div>
        }
      />
      <DataState loading={grid.isLoading} error={grid.isError} onRetry={() => void grid.refetch()} label="grid status">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="gt-card relative overflow-hidden bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] md:col-span-2">
            <div className="gt-label !text-[hsl(var(--sidebar-foreground)/.55)]">Current operating instruction</div>
            <div className="mt-8 flex items-end justify-between">
              <div>
                <div className="text-[28px] font-extrabold tracking-[-.06em]">{g?.label ?? '—'}</div>
                <div className="mt-2 text-[11px] text-[hsl(var(--sidebar-foreground)/.58)]">{g?.decision ?? '—'} · decision is based on local conditions</div>
              </div>
              <div className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] ${decisionTone(g?.decision) === 'approved' ? 'bg-[hsl(var(--accent)/.2)] text-[hsl(var(--sidebar-primary))]' : 'bg-[hsl(var(--primary)/.2)] text-[hsl(var(--sidebar-primary))]'}`}>
                {g?.decision ?? '—'}
              </div>
            </div>
            <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full border border-[hsl(var(--sidebar-primary)/.15)]" />
          </div>
          <SignalCard icon={Gauge} label="Congestion" value={`${formatNumber(g?.congestionPercent)}%`} detail="Lower is more flexible" meter={g?.congestionPercent} inverse />
          <SignalCard icon={SunMedium} label="Renewable share" value={`${formatNumber(g?.renewableSharePercent)}%`} detail="Current local mix" meter={g?.renewableSharePercent} />
          <SignalCard icon={Radio} label="Grid frequency" value={`${g?.frequencyHz?.toFixed(2) ?? '—'} Hz`} detail="Nominal 50.00 Hz" meter={Math.min(Math.abs((g?.frequencyHz ?? 50) - 49.5) * 100, 100)} inverse />
        </div>
      </DataState>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_1fr]">
        <section className="gt-card p-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <div className="gt-label">Signal history</div>
              <h2 className="mt-1 text-base font-extrabold">Generation and load / 24h</h2>
            </div>
            <LineChart size={17} className="text-[hsl(var(--accent))]" />
          </div>
          <Sparkline observations={ensureArray(energy.data)} />
        </section>
        <section className="gt-card p-5">
          <div className="mb-4">
            <div className="gt-label">Decision rationale</div>
            <h2 className="mt-1 text-base font-extrabold">Why this instruction is active</h2>
          </div>
          <div className="space-y-3">
            <RationaleRow label="Congestion headroom" value={`${formatNumber(100 - (g?.congestionPercent ?? 0))}% available`} good={(g?.congestionPercent ?? 100) < 55} />
            <RationaleRow label="Renewable supply" value={`${formatNumber(g?.renewableSharePercent)}% of local mix`} good={(g?.renewableSharePercent ?? 0) > 40} />
            <RationaleRow label="Frequency stability" value={`${g?.frequencyHz?.toFixed(2) ?? '—'} Hz`} good={Math.abs((g?.frequencyHz ?? 50) - 50) < 0.12} />
          </div>
          <div className="mt-6 rounded-lg bg-[hsl(var(--muted)/.55)] p-3 text-[11px] leading-5 text-muted-foreground">
            <div className="font-extrabold text-foreground mb-1">Grid-Aware Trading Protocol:</div>
            Smart trading is not only about finding a buyer and a seller. GridTrade also checks whether the local grid can safely support the trade right now.
            <div className="mt-2 flex flex-wrap gap-1.5 text-[9.5px]">
              <span className="gt-badge border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold">APPROVED: Feeder Safe</span>
              <span className="gt-badge border-amber-500/40 bg-amber-500/10 text-amber-300 font-bold">ADJUSTED: Feeder Capped</span>
              <span className="gt-badge border-red-500/40 bg-red-500/10 text-red-400 font-bold">RESTRICTED: Grid Congested</span>
            </div>
          </div>
        </section>
      </div>
      <section className="gt-card mt-3 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="gt-label">Match recommendations</div>
            <h2 className="mt-1 text-base font-extrabold">Actions that respect the current grid</h2>
          </div>
          <Link href="/marketplace" className="gt-button gt-button-quiet" data-testid="link-grid-marketplace">
            Open marketplace <ChevronRight size={13} />
          </Link>
        </div>
        <DataState loading={matches.isLoading} error={matches.isError} empty={!matches.isLoading && !matchGridList.length} onRetry={() => void matches.refetch()} label="grid matches">
          <div className="grid gap-3 md:grid-cols-2">
            {matchGridList.map((match: any) => (
              <div key={match.id} className="rounded-lg border border-[hsl(var(--border))] p-4 hover:border-[hsl(var(--accent)/.4)] transition-colors cursor-pointer" onClick={() => setSelectedMatch(match)} data-testid={`card-grid-match-${match.id}`}>
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-extrabold">{match.sellerName}</div>
                  <div className="gt-mono text-[12px] text-[hsl(var(--accent))] font-bold">{match.score}% match</div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">{match.rationale}</div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {ensureArray<string>(match.factors).map((factor: string) => (
                      <span key={factor} className="rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-[9px] font-bold text-muted-foreground">{factor}</span>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-[hsl(var(--accent))] flex items-center gap-1">Inspect 6-Factor Fit <ArrowRight size={11} /></span>
                </div>
              </div>
            ))}
          </div>
        </DataState>
      </section>
    </div>
  );
}
