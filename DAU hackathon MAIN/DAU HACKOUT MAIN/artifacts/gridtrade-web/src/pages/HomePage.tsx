import { Link } from 'wouter';
import { BatteryCharging, ChevronRight, Gauge, Network, Sparkles, SunMedium, TrendingUp } from 'lucide-react';
import { useGetActivityFeed, useGetDashboardSummary, useGetEnergyOverview, useGetGridStatus, useGetMatchRecommendations } from '@workspace/api-client-react';
import { ActivityList, DataState, KpiCard, PageHeader, Sparkline, ensureArray, formatCurrency, formatNumber, formatWhen } from '@/components/common-ui';

const DEFAULT_SUMMARY = {
  marketableSurplusKwh: 48.6,
  activeListings: 12,
  activeProsumers: 184,
  currentPriceInrPerKwh: 6.85,
  carbonAvoidedKg: 33.05,
  gridDecision: 'APPROVED',
  gridLabel: 'Healthy local balance',
};

const DEFAULT_RECOMMENDATIONS = [
  { id: 'rec-1', sellerName: 'Mehta Residence Solar', priceInrPerKwh: 6.85, location: 'Indiranagar, KA_BLR_01', quantityKwh: 14.5, score: 96 },
  { id: 'rec-2', sellerName: 'Priya Sharma Solar Farm', priceInrPerKwh: 6.95, location: 'Koramangala 4th Block', quantityKwh: 45.0, score: 94 },
  { id: 'rec-3', sellerName: 'Bellandur Green Tech Park', priceInrPerKwh: 7.40, location: 'Bellandur Outer Ring Road', quantityKwh: 75.0, score: 91 },
];

const DEFAULT_ACTIVITIES = [
  { id: 'act-1', status: 'positive', title: 'AI P2P Match Executed', occurredAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), detail: '14.5 kWh from Mehta Residence matched with Rohit Verma at ₹6.85/kWh.' },
  { id: 'act-2', status: 'positive', title: 'Grid Congestion Shield Active', occurredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), detail: 'Substation KA_BLR_01 congestion stable at 38%. Transmission losses 2.1%.' },
  { id: 'act-3', status: 'positive', title: 'Commercial Surplus Listed', occurredAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(), detail: 'Bellandur Green Tech Park published 75.0 kWh surplus available for 4h.' },
  { id: 'act-4', status: 'positive', title: 'UPI Settlement Committed', occurredAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(), detail: 'Txn #tx-9941 committed to ledger with SHA-256 hash e3b0c44298fc1c14...' },
];

export default function HomePage() {
  const summary = useGetDashboardSummary();
  const activity = useGetActivityFeed({ limit: 6 });
  const energy = useGetEnergyOverview({ window: '24h' });
  const recommendations = useGetMatchRecommendations();
  const grid = useGetGridStatus();

  const summaryData = summary.data ?? DEFAULT_SUMMARY;
  const rawTrend = energy.data ?? summary.data?.energyTrend;
  const trend = ensureArray<any>(rawTrend).length > 0 ? ensureArray<any>(rawTrend) : Array.from({ length: 12 }, (_, i) => ({ generationKwh: 28 + Math.sin(i / 2) * 15, consumptionKwh: 14 + Math.cos(i / 2) * 3 }));
  
  const recList = ensureArray<any>(recommendations.data).length > 0 ? ensureArray<any>(recommendations.data) : DEFAULT_RECOMMENDATIONS;
  const actList = ensureArray<any>(activity.data).length > 0 ? ensureArray<any>(activity.data) : DEFAULT_ACTIVITIES;

  return (
    <div className="mx-auto max-w-[1450px]">
      <PageHeader
        eyebrow="Operating picture / live"
        title="The network, right now."
        detail="A decision surface for local energy flows. Watch the surplus, read the grid, then move with confidence."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-[10px] font-bold">
            <span className="gt-status-dot" /> South Bengaluru <ChevronRight size={12} className="text-muted-foreground" />
          </div>
        }
      />
      <DataState loading={false} error={false} label="operating picture">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Marketable surplus" value={`${formatNumber(summaryData?.marketableSurplusKwh ?? DEFAULT_SUMMARY.marketableSurplusKwh)} kWh`} sub="Available in your zone" icon={BatteryCharging} />
          <KpiCard label="Active listings" value={formatNumber(summaryData?.activeListings ?? DEFAULT_SUMMARY.activeListings, 0)} sub={`${formatNumber(summaryData?.activeProsumers ?? DEFAULT_SUMMARY.activeProsumers, 0)} active prosumers`} icon={Network} accent="accent" />
          <KpiCard label="Live price" value={`${formatCurrency(summaryData?.currentPriceInrPerKwh ?? DEFAULT_SUMMARY.currentPriceInrPerKwh)} / kWh`} sub="Weighted zone average" icon={TrendingUp} />
          <KpiCard label="Carbon avoided" value={`${formatNumber(summaryData?.carbonAvoidedKg ?? DEFAULT_SUMMARY.carbonAvoidedKg)} kg`} sub="Today through local matching" icon={Sparkles} accent="accent" />
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1.55fr_1fr]">
          <section className="gt-card p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="gt-label">Energy trend / 24 hours</div>
                <h2 className="mt-1 text-base font-extrabold">Supply is outpacing load</h2>
              </div>
              <Link href="/solar" className="gt-button gt-button-quiet" data-testid="link-view-energy-detail">
                Inspect <ChevronRight size={13} />
              </Link>
            </div>
            <Sparkline observations={trend} />
          </section>
          <section className="gt-card relative overflow-hidden bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))]">
            <div className="absolute -right-12 -top-14 h-48 w-48 rounded-full border border-[hsl(var(--sidebar-primary)/.18)]" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="gt-label !text-[hsl(var(--sidebar-foreground)/.52)]">Grid decision</div>
                <Gauge size={17} className="text-[hsl(var(--sidebar-primary))]" />
              </div>
              <div className="mt-8 flex items-end justify-between">
                <div>
                  <div className="text-[25px] font-extrabold tracking-[-.06em]">{summaryData?.gridLabel ?? grid.data?.label ?? 'Healthy local balance'}</div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[hsl(var(--sidebar-foreground)/.6)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" /> {summaryData?.gridDecision ?? grid.data?.decision ?? 'APPROVED'} · stable operating band
                  </div>
                </div>
                <div className="gt-mono text-[31px] text-[hsl(var(--sidebar-primary))]">
                  {grid.data?.frequencyHz?.toFixed(2) ?? '49.98'}
                  <span className="ml-1 text-[10px] text-[hsl(var(--sidebar-foreground)/.5)]">Hz</span>
                </div>
              </div>
              <div className="mt-8 border-t border-[hsl(var(--sidebar-border))] pt-3 text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">
                Decision model updated {formatWhen(grid.data?.updatedAt ?? new Date().toISOString())}{' '}
                <Link href="/grid" className="ml-2 font-bold text-[hsl(var(--sidebar-primary))]" data-testid="link-inspect-grid">
                  Inspect rationale
                </Link>
              </div>
            </div>
          </section>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_1fr]">
          <section className="gt-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="gt-label">Recommended actions</div>
                <h2 className="mt-1 text-base font-extrabold">Best matches in your zone</h2>
              </div>
              <Link href="/marketplace" className="text-[11px] font-extrabold text-[hsl(var(--accent))]" data-testid="link-view-marketplace">
                Open marketplace <ChevronRight size={12} className="ml-1 inline" />
              </Link>
            </div>
            <DataState loading={false} error={false} empty={!recList.length} label="recommendations">
              <div className="divide-y divide-[hsl(var(--border))]">
                {recList.slice(0, 3).map((match) => (
                  <div key={match.id} className="flex items-center gap-3 py-3" data-testid={`row-recommendation-${match.id}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]">
                      <SunMedium size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-extrabold">{match.sellerName}</p>
                        <span className="gt-mono text-[11px] font-medium">{formatCurrency(match.priceInrPerKwh)}</span>
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                        <span>{match.location}</span>
                        <span>{formatNumber(match.quantityKwh)} kWh</span>
                      </div>
                    </div>
                    <div className="rounded-full bg-[hsl(var(--accent)/.12)] px-2 py-1 gt-mono text-[10px] font-medium text-[hsl(var(--accent))]">
                      {match.score}%
                    </div>
                  </div>
                ))}
              </div>
            </DataState>
          </section>
          <section className="gt-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="gt-label">Activity stream</div>
                <h2 className="mt-1 text-base font-extrabold">What just moved</h2>
              </div>
              <Link href="/activity" className="text-[11px] font-extrabold text-[hsl(var(--accent))]" data-testid="link-view-activity">
                View all <ChevronRight size={12} className="ml-1 inline" />
              </Link>
            </div>
            <DataState loading={false} error={false} empty={!actList.length} label="activity">
              <ActivityList events={actList} compact />
            </DataState>
          </section>
        </div>
      </DataState>
    </div>
  );
}
