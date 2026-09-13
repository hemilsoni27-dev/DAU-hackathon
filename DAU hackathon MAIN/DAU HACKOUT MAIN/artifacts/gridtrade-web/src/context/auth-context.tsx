import { useState, type FormEvent } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { Check, SlidersHorizontal, X } from 'lucide-react';

export const queryClient = new QueryClient();

export let activeAuthToken = localStorage.getItem('gridtrade_auth_token') || 'demo:prosumer';
setAuthTokenGetter(() => activeAuthToken);

export function updateAuthToken(token: string) {
  activeAuthToken = token;
  localStorage.setItem('gridtrade_auth_token', token);
  queryClient.invalidateQueries();
}

export function getRoleBadgeClass(role?: string) {
  switch (role?.toUpperCase()) {
    case 'PROSUMER':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'CONSUMER':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'UTILITY':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'REGULATOR':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'ADMIN':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    default:
      return 'bg-secondary text-muted-foreground border-border';
  }
}

export const PRESET_ACCOUNTS = [
  { role: 'PROSUMER', token: 'demo:prosumer', name: 'Aarav Sharma', desc: 'Solar asset owner with 12.5 kWp generation capacity', area: 'KA_BLR_01' },
  { role: 'CONSUMER', token: 'demo:consumer', name: 'Priya Nair', desc: 'Clean energy consumer buying green tariff power', area: 'KA_BLR_01' },
  { role: 'UTILITY', token: 'demo:utility', name: 'BESCOM Grid Controller', desc: 'DISCOM distribution operator & grid congestion control', area: 'KA_BLR_01' },
  { role: 'REGULATOR', token: 'demo:regulator', name: 'KERC Regulatory Inspector', desc: 'Statutory compliance & SHA-256 ledger integrity oversight', area: 'KA_BLR_01' },
  { role: 'ADMIN', token: 'demo:admin', name: 'System Administrator', desc: 'Full infrastructure, security safeguards & platform governance', area: 'GLOBAL' },
];

export function AccountSwitcherModal({ open, onClose, currentToken, onSelectToken }: {
  open: boolean;
  onClose: () => void;
  currentToken: string;
  onSelectToken: (token: string) => void;
}) {
  const [customToken, setCustomToken] = useState('');

  if (!open) return null;

  const handleSelect = (token: string) => {
    onSelectToken(token);
    onClose();
  };

  const handleCustomSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (customToken.trim()) {
      onSelectToken(customToken.trim());
      setCustomToken('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="gt-card max-w-lg w-full p-6 space-y-5 border-[hsl(var(--border))] shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
          <div>
            <div className="gt-label text-[hsl(var(--accent))]">Role-Based Access Control</div>
            <h2 className="text-lg font-black tracking-[-.03em]">Switch Active Persona / Auth</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Preset Persona Accounts</div>
          {PRESET_ACCOUNTS.map((acc) => {
            const isActive = currentToken === acc.token;
            return (
              <button
                key={acc.role}
                onClick={() => handleSelect(acc.token)}
                className={`w-full flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  isActive
                    ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.08)] shadow-sm'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--secondary)/.5)]'
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] font-black text-xs">
                  {acc.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm">{acc.name}</span>
                    <span className={`gt-badge text-[10px] font-mono font-bold px-2 py-0.5 border ${getRoleBadgeClass(acc.role)}`}>
                      {acc.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{acc.desc}</p>
                </div>
                {isActive && <Check size={16} className="text-[hsl(var(--accent))] shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-[hsl(var(--border))] space-y-2">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom Auth Token</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. demo:custom or Bearer JWT..."
              value={customToken}
              onChange={(e) => setCustomToken(e.target.value)}
              className="gt-input flex-1 text-xs font-mono"
            />
            <button type="submit" className="gt-button gt-button-primary text-xs px-4">
              Apply Token
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
