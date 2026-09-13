import { useState } from 'react';
import { useLocation } from 'wouter';
import { Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, RefreshCw, ShoppingBag, Sparkles, SunMedium } from 'lucide-react';

export default function AiCockpitPage() {
  const [, setLocation] = useLocation();
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: string[];
    confidence?: number;
    actions?: Array<{ label: string; action: string; targetUrl?: string }>;
  }>>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to the GridTrade AI Energy Assistant. I have analyzed your current solar meter data, grid region status, and active market orders. How can I help optimize your energy trading today?',
      sources: ['GRIDTRADE_SYSTEM_CONTEXT', 'LATEST_ENERGY_DATA'],
      confidence: 0.95,
      actions: [
        { label: 'How much surplus do I have?', action: 'QUERY' },
        { label: 'Should I sell now?', action: 'QUERY' },
        { label: "Why is today's price higher?", action: 'QUERY' },
      ],
    },
  ]);

  const handleSendChat = async (queryText?: string) => {
    const text = queryText || chatInput;
    if (!text.trim() || chatLoading) return;

    const userMsgId = `user-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: text }]);
    if (!queryText) setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/v1/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
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
        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'AI Assistant service is temporarily unavailable. Standard marketplace functionality remains operational.',
            confidence: 0.50,
          },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'AI Assistant service connection offline. Standard marketplace features remain accessible.',
          confidence: 0.50,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const sampleForecastData = [
    { hour: '06:00', generation: 0.8, demand: 2.1 },
    { hour: '08:00', generation: 3.4, demand: 5.2 },
    { hour: '10:00', generation: 7.8, demand: 4.1 },
    { hour: '12:00', generation: 12.4, demand: 3.8 },
    { hour: '14:00', generation: 11.2, demand: 4.2 },
    { hour: '16:00', generation: 6.5, demand: 5.9 },
    { hour: '18:00', generation: 1.8, demand: 8.4 },
    { hour: '20:00', generation: 0.0, demand: 7.6 },
  ];

  return (
    <div className="space-y-6" data-testid="ai-cockpit-page">
      <div className="gt-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="gt-label text-[hsl(var(--accent))] flex items-center gap-1.5">
            <Sparkles size={14} /> AI Intelligence & Decision Support
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-[-.04em] sm:text-3xl">Smart Energy Cockpit</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            FastAPI forecasting, Smart Sell & Smart Buy recommendation engines, anomaly detection, and explainable AI assistant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="gt-badge border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mr-1.5 inline-block"></span>
            FastAPI Service: AVAILABLE
          </span>
          <span className="gt-badge bg-[hsl(var(--muted)/.4)] text-muted-foreground font-mono">
            generation-forecast-v1.0
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="gt-card p-5" data-testid="card-smart-sell">
          <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-400">
              <SunMedium size={18} />
              SMART SELL RECOMMENDATION
            </div>
            <span className="gt-badge border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              Score: 88%
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-[hsl(var(--muted)/.2)] p-3 text-center text-xs">
            <div>
              <div className="text-muted-foreground text-[10px]">Predicted Surplus</div>
              <div className="mt-1 text-base font-extrabold text-emerald-400">7.6 kWh</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Indicative Price</div>
              <div className="mt-1 text-base font-extrabold">₹5.20/kWh</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Est. Revenue</div>
              <div className="mt-1 text-base font-extrabold text-emerald-400">₹39.52</div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">Structured Explanations:</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Solar peak generation window predicted between 11:00 AM – 2:00 PM.</li>
              <li>High local consumer demand in NCR-NORTH sector.</li>
              <li>Grid condition APPROVED: Unrestricted feeder throughput.</li>
            </ul>
          </div>

          <div className="mt-5 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]">
            <span className="text-[10px] text-muted-foreground font-mono">Model: generation-forecast-v1.0</span>
            <button className="gt-button gt-button-primary text-xs" onClick={() => setLocation('/marketplace')} data-testid="button-action-smart-sell">
              Publish Solar Listing <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="gt-card p-5" data-testid="card-smart-buy">
          <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 font-extrabold text-sm text-[hsl(var(--accent))]">
              <ShoppingBag size={18} />
              SMART BUY RECOMMENDATION
            </div>
            <span className="gt-badge border-[hsl(var(--accent)/.4)] bg-[hsl(var(--accent)/.1)] text-[hsl(var(--accent))]">
              Score: 92%
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-[hsl(var(--muted)/.2)] p-3 text-center text-xs">
            <div>
              <div className="text-muted-foreground text-[10px]">Match Quantity</div>
              <div className="mt-1 text-base font-extrabold">12.0 kWh</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Agreed Price</div>
              <div className="mt-1 text-base font-extrabold">₹4.80/kWh</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Est. Savings</div>
              <div className="mt-1 text-base font-extrabold text-emerald-400">₹20.40</div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">Structured Explanations:</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Lowest available price (₹4.80/kWh) compared to ₹6.50 grid tariff.</li>
              <li>Proximity match (1.2 km) minimizes transmission wheeling fees.</li>
              <li>Seller has 98% historical generation reliability rating.</li>
            </ul>
          </div>

          <div className="mt-5 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]">
            <span className="text-[10px] text-muted-foreground font-mono">Model: demand-forecast-v1.0</span>
            <button className="gt-button gt-button-accent text-xs" onClick={() => setLocation('/marketplace')} data-testid="button-action-smart-buy">
              Browse Matches <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="gt-card p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
            <div>
              <div className="gt-label text-[hsl(var(--accent))]">Diurnal Solar & Demand Profile</div>
              <h2 className="text-lg font-black tracking-[-.03em]">24-Hour AI Energy Forecast</h2>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="gt-badge border-amber-500/40 bg-amber-500/10 text-amber-300">
                Confidence: 88%
              </span>
              <span className="gt-badge bg-[hsl(var(--muted)/.4)] text-muted-foreground">
                Updated: Just now
              </span>
            </div>
          </div>

          <div className="h-[260px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sampleForecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} unit=" kWh" />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="generation" name="Predicted Solar Gen (kWh)" stroke="#10b981" fillOpacity={1} fill="url(#solarGradient)" />
                <Area type="monotone" dataKey="demand" name="Predicted Demand (kWh)" stroke="#3b82f6" fillOpacity={1} fill="url(#demandGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="rounded-lg bg-[hsl(var(--muted)/.2)] p-3 border border-[hsl(var(--border))]">
              <div className="text-muted-foreground text-[10px] uppercase font-bold">Peak Solar Window</div>
              <div className="mt-1 font-extrabold text-sm text-emerald-400">11:00 AM – 3:00 PM (12.4 kWh)</div>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted)/.2)] p-3 border border-[hsl(var(--border))]">
              <div className="text-muted-foreground text-[10px] uppercase font-bold">Peak Demand Window</div>
              <div className="mt-1 font-extrabold text-sm text-blue-400">6:00 PM – 10:00 PM (8.4 kWh)</div>
            </div>
          </div>
        </div>

        <div className="gt-card flex flex-col p-5 h-[440px]">
          <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <Sparkles size={16} className="text-[hsl(var(--accent))]" />
              AI Energy Assistant
            </div>
            <span className="gt-badge border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px]">
              ONLINE
            </span>
          </div>

          <div className="my-3 flex-1 space-y-3 overflow-y-auto pr-1 text-xs">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-xl px-3.5 py-2.5 max-w-[88%] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-semibold'
                      : 'bg-[hsl(var(--muted)/.3)] border border-[hsl(var(--border))] text-foreground'
                  }`}
                >
                  {msg.content}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-[hsl(var(--border)/.5)] pt-1.5">
                      <span className="text-[9px] text-muted-foreground font-bold">Sources:</span>
                      {msg.sources.map((src) => (
                        <span key={src} className="rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300">
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
                          className="rounded bg-[hsl(var(--accent)/.2)] px-2 py-1 text-[10px] font-bold text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/.3)] transition"
                          onClick={() => {
                            if (act.action === 'NAVIGATE' && act.targetUrl) setLocation(act.targetUrl);
                            else handleSendChat(act.label);
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
            {chatLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                <RefreshCw size={14} className="animate-spin" /> Assistant processing response…
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[hsl(var(--border))]">
            <input
              type="text"
              className="gt-input text-xs flex-1"
              placeholder="Ask assistant about energy, prices, surplus…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              data-testid="input-chat-assistant"
            />
            <button
              className="gt-button gt-button-primary text-xs"
              onClick={() => handleSendChat()}
              disabled={chatLoading}
              data-testid="button-send-chat"
            >
              Ask
            </button>
          </div>
        </div>
      </div>

      <div className="gt-card p-5 space-y-4" data-testid="section-anomaly-queue">
        <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
          <div>
            <div className="gt-label text-amber-400">Security & Metric Safeguards</div>
            <h2 className="text-lg font-black tracking-[-.03em]">Anomaly Detection Audit Queue</h2>
          </div>
          <span className="gt-badge border-amber-500/40 bg-amber-500/10 text-amber-300">
            anomaly-rule-v1.0
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-muted-foreground font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Risk Score</th>
                <th className="py-2.5 px-3">Entity Type</th>
                <th className="py-2.5 px-3">Triggered Reasons</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border)/.4)]">
              <tr>
                <td className="py-3 px-3">
                  <span className="gt-badge border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold">
                    HIGH
                  </span>
                </td>
                <td className="py-3 px-3 font-mono font-bold text-amber-400">0.78 / 1.0</td>
                <td className="py-3 px-3 font-medium">Trade Frequency</td>
                <td className="py-3 px-3 text-muted-foreground max-w-[280px]">
                  Unusually high trade frequency: 18 trades/min from consumer account.
                </td>
                <td className="py-3 px-3">
                  <span className="gt-badge border-blue-500/40 bg-blue-500/10 text-blue-300 font-bold">
                    OPEN
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button className="gt-button gt-button-quiet !py-1 !px-2 text-[10px]">
                    Resolve / Dismiss
                  </button>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3">
                  <span className="gt-badge border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold">
                    LOW
                  </span>
                </td>
                <td className="py-3 px-3 font-mono font-bold text-emerald-400">0.12 / 1.0</td>
                <td className="py-3 px-3 font-medium">Meter Reading</td>
                <td className="py-3 px-3 text-muted-foreground max-w-[280px]">
                  Metrics within expected baseline bounds.
                </td>
                <td className="py-3 px-3">
                  <span className="gt-badge bg-[hsl(var(--muted)/.4)] text-muted-foreground font-bold">
                    RESOLVED
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="text-[10px] text-muted-foreground">Reviewed</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
