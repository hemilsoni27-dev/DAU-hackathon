import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gauge, Network, SunMedium, TrendingUp } from 'lucide-react';
import { KpiCard, PageHeader, formatWhen } from '@/components/common-ui';

export default function UtilityControlRoomPage() {
  const [activeScenario, setActiveScenario] = useState<string>('BALANCED');
  const [triggering, setTriggering] = useState(false);
  const [, setSelectedFeeder] = useState<string | null>(null);

  const fetchUtilityMetrics = async () => {
    try {
      const res = await fetch('/api/v1/operations/utility/dashboard');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  };

  const { data, refetch } = useQuery({
    queryKey: ['utilityDashboard', activeScenario],
    queryFn: fetchUtilityMetrics,
    refetchInterval: 3000,
  });

  const handleTriggerScenario = async (scenario: string) => {
    setTriggering(true);
    try {
      await fetch('/api/v1/operations/simulation/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'UTILITY' },
        body: JSON.stringify({ scenario, region: 'KA_BLR_01' }),
      });
      setActiveScenario(scenario);
      await refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`/api/v1/operations/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'UTILITY' },
        body: JSON.stringify({ userId: 'operator-01' }),
      });
      await refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const metrics = data || {
    region: 'KA_BLR_01',
    scenario: activeScenario,
    gridStatus: { congestionPercent: 18.2, renewableSharePercent: 62.4, frequencyHz: 50.0, decision: 'APPROVED', recommendedPriceInr: 4.2 },
    marketplaceSummary: { activeListingsCount: 14, openDemandsCount: 9, completedTradesCount: 42, totalKwhTraded: 1850.5, totalWheelingFeeInr: 925.25 },
    feeders: [
      { id: 'FDR-BLR-NORTH', name: 'North Substation Feeder 1', capacityKw: 500, loadKw: 210, status: 'NORMAL' },
      { id: 'FDR-BLR-SOUTH', name: 'South Substation Feeder 2', capacityKw: 750, loadKw: 340, status: 'NORMAL' },
      { id: 'FDR-BLR-EAST', name: 'East Substation Feeder 3', capacityKw: 600, loadKw: 290, status: 'NORMAL' },
      { id: 'FDR-BLR-WEST', name: 'West Industrial Feeder 4', capacityKw: 1000, loadKw: 510, status: 'NORMAL' },
    ],
    recentAlerts: [
      { id: 'alt-001', type: 'CONGESTION_WARNING', severity: 'WARNING', message: 'Feeder 4B experiencing high load (78% capacity). Dynamic pricing adjusted.', createdAt: new Date().toISOString(), acknowledgedBy: null },
    ],
  };

  const scenarios = [
    { id: 'SUNNY_SURPLUS', label: 'Sunny Surplus', desc: 'High solar generation (+40%), low load, zero congestion', icon: '☀️', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
    { id: 'HIGH_DEMAND', label: 'High Demand Peak', desc: 'Evening load spike (+60%), 78% congestion, high price', icon: '⚡', color: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
    { id: 'MODERATE_CONGESTION', label: 'Moderate Congestion', desc: '46% congestion level, adjusted trade quantities', icon: '⚠️', color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' },
    { id: 'SEVERE_CONGESTION', label: 'Severe Overload', desc: '94% thermal overload, grid RESTRICTED safety clamp', icon: '🛑', color: 'border-rose-500/40 bg-rose-500/10 text-rose-400' },
    { id: 'BALANCED', label: 'Balanced Baseline', desc: 'Normal equilibrium, 18% congestion, 50.00 Hz', icon: '⚖️', color: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
  ];

  return (
    <div className="mx-auto max-w-[1450px] space-y-6">
      <PageHeader
        eyebrow="DISCOM Operations / Substation Control Room"
        title="Utility Control Room — KA_BLR_01 Substation"
        detail="Real-time distribution grid management, feeder load balance, wheeling fee collection, and scenario simulation triggers."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            DISCOM Node Active · 24/7 Grid Dispatch
          </div>
        }
      />

      <div className="gt-card p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
          <div>
            <div className="gt-label text-[hsl(var(--accent))]">Scenario Simulator & Dispatch Engine</div>
            <h2 className="text-lg font-black tracking-[-.03em]">Real-Time Grid Stress Testing</h2>
          </div>
          <span className="gt-badge border-[hsl(var(--accent)/.4)] bg-[hsl(var(--accent)/.1)] text-[hsl(var(--accent))]">
            Active: {metrics.scenario}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {scenarios.map((sc) => {
            const isActive = metrics.scenario === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => handleTriggerScenario(sc.id)}
                disabled={triggering}
                className={`flex flex-col text-left p-4 rounded-xl border transition-all ${
                  isActive
                    ? `${sc.color} ring-2 ring-[hsl(var(--accent))] shadow-lg`
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/.3)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{sc.icon}</span>
                  {isActive && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(var(--accent))] text-black">Active</span>}
                </div>
                <div className="font-extrabold text-sm mb-1">{sc.label}</div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">{sc.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Substation Congestion" value={`${metrics.gridStatus.congestionPercent}%`} sub={`Grid Decision: ${metrics.gridStatus.decision}`} icon={Gauge} accent={metrics.gridStatus.congestionPercent > 70 ? 'accent' : 'primary'} />
        <KpiCard label="Renewable Mix" value={`${metrics.gridStatus.renewableSharePercent}%`} sub={`Frequency: ${metrics.gridStatus.frequencyHz.toFixed(2)} Hz`} icon={SunMedium} />
        <KpiCard label="Wheeling Revenue" value={`₹${metrics.marketplaceSummary.totalWheelingFeeInr.toFixed(2)}`} sub={`From ${metrics.marketplaceSummary.completedTradesCount} confirmed trades`} icon={TrendingUp} accent="accent" />
        <KpiCard label="Active Zone Demand" value={`${metrics.marketplaceSummary.openDemandsCount} Demands`} sub={`${metrics.marketplaceSummary.activeListingsCount} Available Listings`} icon={Network} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="gt-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
            <div>
              <div className="gt-label">Feeders & Transformers</div>
              <h2 className="text-lg font-black tracking-[-.03em]">Distribution Feeder Load Status</h2>
            </div>
            <span className="text-xs text-muted-foreground font-mono">4 Active Feeders</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.feeders.map((f: any) => {
              const loadPercent = Math.min(Math.round((f.loadKw / f.capacityKw) * 100), 100);
              const isCritical = f.status === 'CRITICAL' || loadPercent > 85;
              const isCongested = f.status === 'CONGESTED' || loadPercent > 65;

              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFeeder(f.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isCritical
                      ? 'border-rose-500/50 bg-rose-500/10'
                      : isCongested
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-sm">{f.name}</span>
                    <span className={`gt-badge text-[10px] font-bold ${
                      isCritical ? 'border-rose-500/40 bg-rose-500/20 text-rose-300' : isCongested ? 'border-amber-500/40 bg-amber-500/20 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {f.status}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground font-mono">{f.loadKw} kW / {f.capacityKw} kW</span>
                    <span className="font-bold font-mono">{loadPercent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[hsl(var(--muted)/.4)] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isCritical ? 'bg-rose-500' : isCongested ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${loadPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="gt-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
            <div>
              <div className="gt-label text-rose-400">Emergency & System Safeguards</div>
              <h2 className="text-lg font-black tracking-[-.03em]">Live Grid Alerts Queue</h2>
            </div>
            <span className="gt-badge border-rose-500/40 bg-rose-500/10 text-rose-300">
              {metrics.recentAlerts.length} Active
            </span>
          </div>

          <div className="space-y-3">
            {metrics.recentAlerts.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No active grid alerts. System operating within normal thresholds.</div>
            ) : (
              metrics.recentAlerts.map((alt: any) => (
                <div key={alt.id} className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="gt-badge border-amber-500/40 bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        {alt.severity || 'WARNING'}
                      </span>
                      <span className="text-xs font-bold">{alt.type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{alt.message}</p>
                    <div className="text-[10px] text-muted-foreground font-mono">{formatWhen(alt.createdAt)}</div>
                  </div>
                  {alt.acknowledgedBy ? (
                    <span className="gt-badge border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">Ack</span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledgeAlert(alt.id)}
                      className="gt-button gt-button-quiet !py-1 !px-2 text-[10px] text-amber-300 hover:text-white"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
