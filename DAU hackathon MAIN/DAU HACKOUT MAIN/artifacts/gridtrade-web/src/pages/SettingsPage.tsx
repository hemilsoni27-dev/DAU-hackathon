import { useState } from 'react';
import { Check, CircleAlert, Cpu, Radio, UserRound } from 'lucide-react';
import { useGetAuthSession, useHealthCheck } from '@workspace/api-client-react';
import { IconType, PageHeader } from '@/components/common-ui';

function SettingRow({ label, value, icon: Icon, good }: { label: string; value: string; icon: IconType; good?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Icon size={14} /> {label}</div>
      <div className={`flex items-center gap-1.5 text-[11px] font-extrabold ${good ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--primary))]'}`}>{good ? <Check size={13} /> : <CircleAlert size={13} />}{value}</div>
    </div>
  );
}

export default function SettingsPage() {
  const session = useGetAuthSession();
  const health = useHealthCheck();
  const [saved, setSaved] = useState(false);
  return (
    <div className="mx-auto max-w-[920px]">
      <PageHeader eyebrow="Settings / session context" title="Make the control room yours." detail="Review the session boundary and the role context that shapes what GridTrade can coordinate for you." />
      <div className="grid gap-3 md:grid-cols-[1.1fr_.9fr]">
        <section className="gt-card p-5 sm:p-6">
          <div className="gt-label">Authenticated session</div>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.17)] text-lg font-extrabold text-[hsl(var(--primary))]">
              {session.data?.displayName?.slice(0, 2).toUpperCase() ?? 'GT'}
            </div>
            <div>
              <h2 className="text-lg font-extrabold">{session.data?.displayName ?? 'Loading session'}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{session.data?.role ?? 'Resolving role context'}</p>
            </div>
          </div>
          <div className="mt-7 space-y-3">
            <SettingRow label="Authentication" value={session.data?.authenticated ? 'Authenticated' : 'Not authenticated'} icon={UserRound} good={session.data?.authenticated} />
            <SettingRow label="Role context" value={session.data?.role ?? '—'} icon={Cpu} good />
            <SettingRow label="Service health" value={health.data?.status ?? (health.isLoading ? 'Checking…' : 'Unavailable')} icon={Radio} good={health.data?.status === 'ok'} />
          </div>
        </section>
        <section className="gt-card p-5 sm:p-6">
          <div className="gt-label">Workspace preferences</div>
          <h2 className="mt-2 text-base font-extrabold">Operational defaults</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="gt-label mb-1.5 block">Primary operating zone</span>
              <select className="gt-input" defaultValue="South Bengaluru" data-testid="select-operating-zone">
                <option>South Bengaluru</option>
                <option>East Bengaluru</option>
                <option>North Bengaluru</option>
              </select>
            </label>
            <label className="block">
              <span className="gt-label mb-1.5 block">Default observation window</span>
              <select className="gt-input" defaultValue="24h" data-testid="select-observation-window">
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>
            <button className="gt-button gt-button-primary w-full" onClick={() => setSaved(true)} data-testid="button-save-settings">
              {saved ? <><Check size={14} /> Preferences saved</> : 'Save preferences'}
            </button>
          </div>
        </section>
      </div>
      <section className="gt-card mt-3 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-[hsl(var(--accent)/.12)] p-2 text-[hsl(var(--accent))]"><Check size={16} /></div>
          <div>
            <h2 className="text-sm font-extrabold">Your role changes the decision surface</h2>
            <p className="mt-1 max-w-[650px] text-xs leading-5 text-muted-foreground">GridTrade keeps the operating picture shared, while role context controls which actions are emphasized. Your current role is read from the authenticated platform session.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
