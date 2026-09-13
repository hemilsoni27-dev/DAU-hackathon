import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BatteryCharging, Check, CircleAlert, CircleCheck, MapPin, Plus, SunMedium } from 'lucide-react';
import {
  getListSolarSystemsQueryKey,
  useCreateSolarSystem,
  useGetAuthSession,
  useListSolarSystems,
} from '@workspace/api-client-react';
import { DataState, KpiCard, PageHeader, ensureArray, formatNumber } from '@/components/common-ui';
import { updateAuthToken } from '@/context/auth-context';

export default function SolarPage() {
  const systems = useListSolarSystems();
  const create = useCreateSolarSystem();
  const { data: session } = useGetAuthSession();
  const userRole = session?.role || 'PROSUMER';
  const isProsumerOrAdmin = userRole === 'PROSUMER' || userRole === 'ADMIN';

  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [form, setForm] = useState({ name: '', capacityKw: '', location: '' });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isProsumerOrAdmin) {
      setFeedback(`Solar registration requires PROSUMER or ADMIN role permissions. (Current Role: ${userRole})`);
      return;
    }
    create.mutate(
      { data: { name: form.name, capacityKw: Number(form.capacityKw), location: form.location } },
      {
        onSuccess: () => {
          setOpen(false);
          setFeedback('✅ Solar system registered successfully.');
          setForm({ name: '', capacityKw: '', location: '' });
          void client.invalidateQueries({ queryKey: getListSolarSystemsQueryKey() });
        },
        onError: (err: any) => {
          const msg = err?.message || '';
          if (msg.includes('403') || msg.includes('permission')) {
            setFeedback(`❌ Permission Denied: Solar system registration requires PROSUMER or ADMIN role. Active role is ${userRole}.`);
          } else {
            setFeedback('❌ Could not register this system. Check all required fields and network connection.');
          }
        },
      }
    );
  };

  const systemList = ensureArray<any>(systems.data);
  const totalGeneration = systemList.reduce((sum, system) => sum + (system.todayGenerationKwh || 0), 0);
  const totalConsumption = systemList.reduce((sum, system) => sum + (system.todayConsumptionKwh || 0), 0);

  return (
    <div className="mx-auto max-w-[1450px] space-y-4">
      <PageHeader
        eyebrow="Solar systems / owned assets"
        title="Know every panel in the network."
        detail="Keep your generation assets current so the marketplace and grid model can make better calls."
        action={
          <button
            className="gt-button gt-button-primary"
            onClick={() => {
              setFeedback('');
              setOpen(true);
            }}
            data-testid="button-add-solar"
          >
            <Plus size={15} /> Register system
          </button>
        }
      />

      {!isProsumerOrAdmin && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <CircleAlert size={18} className="shrink-0" />
            <div>
              <span className="font-bold">Active Persona Role: {userRole}</span> — Solar asset registration requires <span className="font-bold underline">PROSUMER</span> or <span className="font-bold underline">ADMIN</span> role permissions.
            </div>
          </div>
          <button
            onClick={() => updateAuthToken('demo:prosumer')}
            className="gt-button gt-button-primary !py-1.5 !px-3 text-xs bg-amber-500 text-black hover:bg-amber-400 shrink-0"
          >
            Switch to PROSUMER (`demo:prosumer`)
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
            feedback.includes('✅')
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/35 bg-rose-500/10 text-rose-400'
          }`}
          data-testid="status-solar-feedback"
        >
          <CircleCheck size={14} /> {feedback}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Registered systems" value={formatNumber(systemList.length, 0)} sub="Assets in your account" icon={SunMedium} />
        <KpiCard label="Generation today" value={`${formatNumber(totalGeneration)} kWh`} sub="Across all systems" icon={SunMedium} accent="accent" />
        <KpiCard label="Local consumption" value={`${formatNumber(totalConsumption)} kWh`} sub="Behind-the-meter load" icon={BatteryCharging} />
      </div>

      <DataState loading={systems.isLoading} error={systems.isError} empty={!systems.isLoading && !systemList.length} onRetry={() => void systems.refetch()} label="solar systems">
        <div className="grid gap-3 md:grid-cols-2">
          {systemList.map((system) => (
            <article className="gt-card p-5" key={system.id} data-testid={`card-solar-${system.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.16)] text-[hsl(var(--primary))]">
                    <SunMedium size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold">{system.name}</h2>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MapPin size={10} /> {system.location}
                    </p>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] ${system.status === 'online' ? 'text-[hsl(var(--accent))]' : 'text-muted-foreground'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${system.status === 'online' ? 'bg-[hsl(var(--accent))]' : 'bg-muted-foreground'}`} /> {system.status}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 border-y border-[hsl(var(--border))] py-4">
                <div>
                  <div className="gt-label">Capacity</div>
                  <div className="gt-mono mt-1 text-[16px]">
                    {formatNumber(system.capacityKw)} <span className="text-[10px] text-muted-foreground">kW</span>
                  </div>
                </div>
                <div>
                  <div className="gt-label">Generated</div>
                  <div className="gt-mono mt-1 text-[16px] text-[hsl(var(--accent))]">
                    {formatNumber(system.todayGenerationKwh)} <span className="text-[10px] text-muted-foreground">kWh</span>
                  </div>
                </div>
                <div>
                  <div className="gt-label">Consumed</div>
                  <div className="gt-mono mt-1 text-[16px]">
                    {formatNumber(system.todayConsumptionKwh)} <span className="text-[10px] text-muted-foreground">kWh</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Net available today</span>
                <span className="gt-mono font-medium text-foreground">{formatNumber(system.todayGenerationKwh - system.todayConsumptionKwh)} kWh</span>
              </div>
            </article>
          ))}
        </div>
      </DataState>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--sidebar)/.55)] p-3 sm:items-center">
          <div className="gt-card w-full max-w-[460px] p-5 sm:p-6" role="dialog" aria-modal="true" data-testid="dialog-add-solar">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="gt-label text-[hsl(var(--accent))]">Asset Registration</div>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-.04em]">Register Solar Generation System</h2>
              </div>
              <button onClick={() => setOpen(false)} data-testid="button-close-add-solar">
                <CircleAlert size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="gt-label mb-1.5 block">System name</span>
                <input
                  className="gt-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="East roof array"
                  required
                  data-testid="input-solar-name"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="gt-label mb-1.5 block">Capacity (kW)</span>
                  <input
                    className="gt-input"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.capacityKw}
                    onChange={(e) => setForm({ ...form, capacityKw: e.target.value })}
                    required
                    data-testid="input-solar-capacity"
                  />
                </label>
                <label>
                  <span className="gt-label mb-1.5 block">Location</span>
                  <input
                    className="gt-input"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="HSR Layout"
                    required
                    data-testid="input-solar-location"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="gt-button gt-button-quiet" onClick={() => setOpen(false)} data-testid="button-cancel-solar">
                  Cancel
                </button>
                <button className="gt-button gt-button-primary" disabled={create.isPending} type="submit" data-testid="button-submit-solar">
                  {create.isPending ? 'Registering…' : <><Check size={14} /> Register system</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
