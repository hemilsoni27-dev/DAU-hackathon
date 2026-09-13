import { useState, lazy, Suspense, type ReactNode } from 'react';
import { QueryClientProvider, } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity,
  Grid3X3,
  Gauge,
  LayoutDashboard,
  Menu,
  Network,
  Radio,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  UserRound,
  X,
  Zap,
  Clock3,
} from 'lucide-react';
import { useGetAuthSession } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { DemoPanel } from '@/components/DemoPanel';
import NotFound from '@/pages/not-found';
import { AccessDeniedPage } from '@/components/common-ui';
import {
  queryClient,
  activeAuthToken,
  updateAuthToken,
  getRoleBadgeClass,
  PRESET_ACCOUNTS,
  AccountSwitcherModal,
} from '@/context/auth-context';

// ─── Route-level code-split page components ──────────────────────────────────
const HomePage = lazy(() => import('@/pages/HomePage'));
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'));
const SolarPage = lazy(() => import('@/pages/SolarPage'));
const GridPage = lazy(() => import('@/pages/GridPage'));
const AiCockpitPage = lazy(() => import('@/pages/AiCockpitPage'));
const LedgerPage = lazy(() => import('@/pages/LedgerPage'));
const ActivityPage = lazy(() => import('@/pages/ActivityPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const UtilityControlRoomPage = lazy(() => import('@/pages/UtilityControlRoomPage'));
const AdminControlRoomPage = lazy(() => import('@/pages/AdminControlRoomPage'));
const RegulatorPortalPage = lazy(() => import('@/pages/RegulatorPortalPage'));
const AuditExplorerPage = lazy(() => import('@/pages/AuditExplorerPage'));

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

type IconType = typeof LayoutDashboard;

const navItems: { href: string; label: string; icon: IconType; detail: string; requiredRole?: string }[] = [
  { href: '/', label: 'Operating picture', icon: LayoutDashboard, detail: 'Live system view' },
  { href: '/marketplace', label: 'Marketplace', icon: Network, detail: 'Buy and publish' },
  { href: '/utility', label: 'Utility Control Room', icon: Gauge, detail: 'DISCOM grid operations', requiredRole: 'UTILITY' },
  { href: '/regulator', label: 'Regulator Portal', icon: ShieldCheck, detail: 'Oversight & audit', requiredRole: 'REGULATOR' },
  { href: '/admin', label: 'Admin Control Room', icon: SlidersHorizontal, detail: 'System health & RBAC', requiredRole: 'ADMIN' },
  { href: '/solar', label: 'Solar systems', icon: SunMedium, detail: 'Owned assets' },
  { href: '/grid', label: 'Grid conditions', icon: Grid3X3, detail: 'Decisions and signals' },
  { href: '/ai', label: 'AI Cockpit', icon: Sparkles, detail: 'Forecasts & assistant' },
  { href: '/ledger', label: 'SHA-256 Ledger', icon: ShieldCheck, detail: 'Cryptographic audit' },
  { href: '/activity', label: 'Activity', icon: Activity, detail: 'Persisted events' },
  { href: '/audit', label: 'Audit Explorer', icon: Clock3, detail: 'Complete event log' },
];

// ─── Floating Chatbot Widget (kept inline — lightweight) ─────────────────────

function FloatingChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: string[];
    confidence?: number;
    actions?: Array<{ label: string; action: string; targetUrl?: string }>;
  }>>([
    {
      id: 'init-1',
      role: 'assistant',
      content: 'Hello! I am your **GridTrade AI Energy Assistant**. How can I help with your energy strategy or grid conditions today?',
      sources: ['GRIDTRADE_SYSTEM_CONTEXT'],
      confidence: 0.95,
      actions: [
        { label: 'Why was my trade adjusted?', action: 'QUERY' },
        { label: 'Should I buy energy now?', action: 'QUERY' },
        { label: 'Explain current price', action: 'QUERY' },
      ],
    },
  ]);

  const starterPrompts = [
    'Explain my current grid status',
    'Should I buy energy now?',
    'Why was my trade adjusted?',
    'Explain the current price',
    'How much surplus can I sell?',
    'Why is GridTrade different?',
  ];

  const handleSend = async (queryText?: string) => {
    const text = queryText || input;
    if (!text.trim() || loading) return;

    const userMsgId = `usr-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: text }]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: data.answer,
            sources: data.sources,
            confidence: data.confidence,
            actions: data.suggestedActions,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'The AI Assistant is currently operating in offline mode. Marketplace and grid dispatch remain 100% operational.',
            confidence: 0.5,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Connection to AI Assistant service interrupted. Standard trading features remain available.',
          confidence: 0.5,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end" data-testid="floating-chatbot-widget">
      {open ? (
        <div className="gt-card flex h-[540px] w-[92vw] max-w-[420px] flex-col overflow-hidden shadow-2xl border border-[hsl(var(--accent)/.4)] bg-[hsl(var(--card))]">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--sidebar))] px-4 py-3 text-[hsl(var(--sidebar-foreground))]">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent))]">
                <Sparkles size={15} />
              </div>
              <div>
                <div className="text-xs font-extrabold">GridTrade AI Energy Assistant</div>
                <div className="text-[9px] text-[hsl(var(--sidebar-foreground)/.6)]">Context-Grounded Copilot</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="gt-badge border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">LIVE</span>
              <button className="rounded p-1 hover:bg-[hsl(var(--border))]" onClick={() => setOpen(false)} aria-label="Minimize chatbot" data-testid="button-minimize-chatbot">
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-2 text-[10px]">
            {starterPrompts.map((p) => (
              <button
                key={p}
                className="shrink-0 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1 font-semibold text-muted-foreground hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--accent))] transition-colors"
                onClick={() => handleSend(p)}
                data-testid={`prompt-chip-${p.substring(0, 10).toLowerCase().replaceAll(' ', '-')}`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-xl px-3.5 py-2.5 max-w-[90%] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-semibold'
                      : 'bg-[hsl(var(--muted)/.35)] border border-[hsl(var(--border))] text-foreground'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-[hsl(var(--border)/.4)] pt-1.5">
                      <span className="text-[9px] text-muted-foreground font-bold">Data Sources:</span>
                      {msg.sources.map((src) => (
                        <span key={src} className="rounded bg-black/40 px-1.5 py-0.5 text-[8.5px] font-mono text-emerald-300">
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pt-1">
                      {msg.actions.map((act) => (
                        <button
                          key={act.label}
                          className="rounded bg-[hsl(var(--accent)/.15)] px-2 py-1 text-[10px] font-bold text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/.25)] transition"
                          onClick={() => {
                            if (act.action === 'NAVIGATE' && act.targetUrl) setLocation(act.targetUrl);
                            else handleSend(act.label);
                          }}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                <Sparkles size={14} className="animate-spin" /> Processing your question…
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-[hsl(var(--border))] p-3">
            <input
              type="text"
              className="gt-input flex-1 text-xs"
              placeholder="Ask about energy, grid, prices…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              data-testid="input-floating-chat"
            />
            <button className="gt-button gt-button-primary text-xs" onClick={() => handleSend()} disabled={loading} data-testid="button-send-floating-chat">
              Send
            </button>
          </div>
        </div>
      ) : (
        <button
          className="gt-button gt-button-accent flex items-center gap-2 shadow-xl hover:scale-105 transition-transform"
          onClick={() => setOpen(true)}
          data-testid="button-open-floating-chatbot"
        >
          <Sparkles size={16} />
          <span className="font-extrabold text-xs">AI Energy Assistant</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}
    </div>
  );
}

// ─── Suspense Fallback ───────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <div className="h-10 w-10 rounded-xl bg-[hsl(var(--accent)/.15)] flex items-center justify-center animate-pulse">
        <Zap size={20} className="text-[hsl(var(--accent))]" />
      </div>
      <p className="text-xs font-bold text-muted-foreground">Loading module…</p>
    </div>
  );
}

// ─── App Shell ───────────────────────────────────────────────────────────────

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: session, isLoading: sessionLoading } = useGetAuthSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const displayName = session?.displayName || 'Control room';
  const role = session?.role || 'PROSUMER';
  const currentToken = activeAuthToken;

  const handleSelectToken = (token: string) => {
    updateAuthToken(token);
  };

  return (
    <div className="gt-shell flex">
      <aside className="gt-sidebar hidden w-[238px] shrink-0 flex-col border-r border-[hsl(var(--sidebar-border))] lg:flex">
        <div className="flex h-[78px] items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]">
            <Zap size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[15px] font-extrabold tracking-[-.04em]">GridTrade</div>
            <div className="gt-label !text-[hsl(var(--sidebar-foreground)/.45)]">Local energy network</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="gt-status-dot" />
          <div className="text-[11px] font-bold text-[hsl(var(--sidebar-foreground)/.72)]">Network live</div>
          <div className="ml-auto gt-mono text-[10px] text-[hsl(var(--sidebar-foreground)/.42)]">24 / 7</div>
        </div>
        <nav className="flex-1 space-y-1 pr-4">
          <div className="px-5 pb-2 pt-1 text-[9px] font-extrabold uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.35)]">
            Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            const isRestricted = item.requiredRole && role !== item.requiredRole && role !== 'ADMIN';
            return (
              <Link
                href={item.href}
                key={item.href}
                className={`gt-nav-item ${active ? 'gt-nav-active' : ''} ${isRestricted ? 'opacity-75' : ''}`}
                data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {isRestricted ? (
                  <span className="ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-400">
                    {item.requiredRole}
                  </span>
                ) : (
                  active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[hsl(var(--sidebar-border))] p-4 space-y-2">
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[hsl(var(--sidebar-accent))]"
            data-testid="button-nav-account"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary)/.18)] text-[11px] font-extrabold text-[hsl(var(--sidebar-primary))]">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[11px] font-extrabold">{sessionLoading ? 'Loading...' : displayName}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`gt-badge text-[9px] font-mono font-bold px-1.5 py-0 border ${getRoleBadgeClass(role)}`}>
                  {role}
                </span>
              </div>
            </div>
            <UserRound size={14} className="text-[hsl(var(--sidebar-foreground)/.4)] shrink-0" />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-[hsl(var(--sidebar)/.55)] lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`gt-sidebar fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r border-[hsl(var(--sidebar-border))] transition-transform lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[78px] items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]">
              <Zap size={18} />
            </div>
            <span className="font-extrabold">GridTrade</span>
          </div>
          <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation">
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-1 pr-4 pt-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} key={item.href} onClick={() => setMobileOpen(false)} className="gt-nav-item">
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link href="/settings" onClick={() => setMobileOpen(false)} className="gt-nav-item">
            <Settings2 size={16} />
            <span>Settings</span>
          </Link>
        </nav>
      </aside>
      <main className="gt-main flex min-h-[100dvh] flex-1 flex-col">
        <header className="gt-topbar sticky top-0 z-30 flex h-[64px] items-center justify-between px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              data-testid="button-open-navigation"
            >
              <Menu size={19} />
            </button>
            <div className="lg:hidden text-sm font-extrabold">GridTrade</div>
            <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
              <Radio size={13} className="text-[hsl(var(--accent))]" /> Local dispatch /{' '}
              <span className="font-bold text-foreground">South Bengaluru (KA_BLR_01)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-400 sm:flex">
              <span className="gt-status-dot" /> SSE Realtime <span className="gt-mono text-emerald-300">Connected</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-xs font-bold transition-colors hover:bg-[hsl(var(--secondary))]"
                data-testid="button-header-profile"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--accent)/.2)] text-[10px] font-extrabold text-[hsl(var(--accent))]">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-extrabold">{displayName}</span>
                <span className={`gt-badge text-[9px] font-mono font-bold px-1.5 py-0.5 border ${getRoleBadgeClass(role)}`}>
                  {role}
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-xl z-50 space-y-2 animate-in fade-in duration-150">
                  <div className="px-2 pb-2 border-b border-[hsl(var(--border))]">
                    <div className="text-xs font-extrabold">{displayName}</div>
                    <div className="text-[11px] text-muted-foreground">Role: {role}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">Token: {currentToken}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase px-2">Quick Persona Switch</div>
                    {PRESET_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.role}
                        onClick={() => {
                          handleSelectToken(acc.token);
                          setUserMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs text-left transition-colors ${
                          currentToken === acc.token ? 'bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))] font-bold' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="truncate">{acc.name}</span>
                        <span className={`gt-badge text-[9px] px-1 py-0 border ${getRoleBadgeClass(acc.role)}`}>{acc.role}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[hsl(var(--border))]">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setAuthModalOpen(true);
                      }}
                      className="w-full gt-button gt-button-quiet text-xs justify-center"
                    >
                      <SlidersHorizontal size={13} /> Switch Persona / Custom Auth
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="gt-page-enter flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</div>
      </main>
      <FloatingChatbotWidget />
      <AccountSwitcherModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentToken={currentToken}
        onSelectToken={handleSelectToken}
      />
    </div>
  );
}

// ─── Protected Route ─────────────────────────────────────────────────────────

function ProtectedRoute({ path, allowedRoles, component: Component }: {
  path: string;
  allowedRoles: string[];
  component: React.ComponentType<any>;
}) {
  const { data: session } = useGetAuthSession();
  const role = session?.role || 'PROSUMER';

  if (!allowedRoles.includes(role)) {
    return (
      <Route path={path}>
        <AccessDeniedPage requiredRole={allowedRoles[0]} currentRole={role} />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}

// ─── Router ──────────────────────────────────────────────────────────────────

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <AppShell>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/marketplace" component={MarketplacePage} />
            <ProtectedRoute path="/utility" allowedRoles={['UTILITY', 'ADMIN']} component={UtilityControlRoomPage} />
            <ProtectedRoute path="/admin" allowedRoles={['ADMIN']} component={AdminControlRoomPage} />
            <ProtectedRoute path="/regulator" allowedRoles={['REGULATOR', 'ADMIN']} component={RegulatorPortalPage} />
            <Route path="/audit" component={AuditExplorerPage} />
            <Route path="/solar" component={SolarPage} />
            <Route path="/grid" component={GridPage} />
            <Route path="/ai" component={AiCockpitPage} />
            <Route path="/ledger" component={LedgerPage} />
            <Route path="/activity" component={ActivityPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </AppShell>
    </ErrorBoundary>
  );
}

// ─── App Entry ───────────────────────────────────────────────────────────────

function App() {
  const [demoToken, setDemoToken] = useState(() => localStorage.getItem('gridtrade_auth_token') || 'demo:prosumer');

  const handleTokenChange = (newToken: string) => {
    setDemoToken(newToken);
    updateAuthToken(newToken);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster />
      {IS_DEMO_MODE && (
        <DemoPanel
          activeToken={demoToken}
          onTokenChange={handleTokenChange}
        />
      )}
    </QueryClientProvider>
  );
}

export default App;