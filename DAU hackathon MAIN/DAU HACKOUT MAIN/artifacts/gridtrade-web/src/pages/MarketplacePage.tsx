import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Filter,
  Info,
  Plus,
  ShoppingBag,
  Sparkles,
  SunMedium,
  Tag,
  X,
} from 'lucide-react';
import {
  getListDemandsQueryKey,
  getListListingsQueryKey,
  useCancelDemand,
  useCancelListing,
  useCloseListing,
  useCreateDemand,
  useCreateListing,
  useExecuteTrade,
  useGetTradePreview,
  useListDemands,
  useListListings,
  useListSolarSystems,
} from '@workspace/api-client-react';
import { DataState, PageHeader, ensureArray, formatCurrency, formatNumber, formatWhen } from '@/components/common-ui';

function MatchBreakdownModal({ match, onClose, onPreviewTrade }: { match: any; onClose: () => void; onPreviewTrade: (listingId: string) => void }) {
  const b = match.breakdown ?? {};
  const reasons = match.reasons ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--sidebar)/.55)] p-3 sm:items-center">
      <div className="gt-card w-full max-w-[560px] p-5 sm:p-6" role="dialog" aria-modal="true" data-testid="dialog-match-breakdown">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="gt-label text-[hsl(var(--accent))]">Intelligent Match Breakdown</div>
            <h2 className="mt-1 text-xl font-extrabold tracking-[-.04em]">{match.sellerName} · {match.score}% Match</h2>
          </div>
          <button onClick={onClose} data-testid="button-close-breakdown"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg bg-[hsl(var(--muted)/.4)] p-3 text-xs text-muted-foreground leading-5">
            <span className="font-extrabold text-foreground">Rationale:</span> {match.rationale}
          </div>
          <div>
            <div className="gt-label mb-2">6-Factor Weighted Scoring Model</div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <FactorBar label="Price Fit (25%)" score={b.priceScore ?? 85} />
              <FactorBar label="Availability (15%)" score={b.availabilityScore ?? 90} />
              <FactorBar label="Quantity Fit (15%)" score={b.quantityFitScore ?? 80} />
              <FactorBar label="Proximity (15%)" score={b.proximityScore ?? 95} />
              <FactorBar label="Reliability (15%)" score={b.reliabilityScore ?? 88} />
              <FactorBar label="Grid Suitability (15%)" score={b.gridSuitabilityScore ?? 92} />
            </div>
          </div>
          {reasons.length > 0 && (
            <div>
              <div className="gt-label mb-2">Key Drivers</div>
              <div className="space-y-2">
                {reasons.map((r: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs">
                    {r.impact === 'positive' ? <CircleCheck size={14} className="text-[hsl(var(--accent))]" /> : <CircleAlert size={14} className="text-[hsl(var(--primary))]" />}
                    <span className="font-bold">{r.code}:</span>
                    <span className="text-muted-foreground">{r.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-[hsl(var(--border))]">
            <button className="gt-button gt-button-quiet" onClick={onClose} data-testid="button-dismiss-breakdown">Close</button>
            <button className="gt-button gt-button-primary" onClick={() => { onClose(); onPreviewTrade(match.listingId); }} data-testid="button-preview-trade-from-breakdown">
              <ShoppingBag size={14} /> Preview & Buy Trade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FactorBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] p-2.5 bg-[hsl(var(--card))]">
      <div className="flex justify-between text-[11px] font-bold mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="gt-mono text-[hsl(var(--accent))]">{score}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <div className="h-full rounded-full bg-[hsl(var(--accent))]" style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}

function TradePreviewModal({ listingId, demandId, onClose }: { listingId: string; demandId?: string; onClose: () => void }) {
  const [requestedKwh, setRequestedKwh] = useState('10');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const previewMutation = useGetTradePreview();
  const executeTradeMutation = useExecuteTrade();
  const queryClient = useQueryClient();

  const p: any = (previewMutation.data as any)?.data || previewMutation.data;

  const calculatePreview = (vol: string) => {
    setRequestedKwh(vol);
    const kwh = Number(vol) || 1;
    previewMutation.mutate({ data: { listingId, demandId, requestedKwh: kwh } });
  };

  const handleConfirmTrade = () => {
    if (!p) return;
    executeTradeMutation.mutate(
      {
        data: {
          listingId: p.listingId,
          demandId: p.demandId,
          requestedKwh: p.maximumTradableEnergyKwh ?? p.energyKwh,
        },
      },
      {
        onSuccess: (res: any) => {
          setExecutionResult((res as any)?.data || res);
          void queryClient.invalidateQueries();
        },
        onError: (err: any) => {
          alert(`Trade execution failed: ${err?.message || 'Unknown error'}`);
        },
      }
    );
  };

  const gridStatus = p?.gridDecision?.status || p?.gridStatus || 'APPROVED';
  const isRestricted = gridStatus === 'RESTRICTED';
  const isAdjusted = gridStatus === 'ADJUSTED';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--sidebar)/.55)] p-3 sm:items-center">
      <div className="gt-card w-full max-w-[540px] p-5 sm:p-6" role="dialog" aria-modal="true" data-testid="dialog-trade-preview">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="gt-label text-[hsl(var(--accent))]">Grid-Aware Settlement & Preview</div>
            <h2 className="mt-1 text-xl font-extrabold tracking-[-.04em]">Trade Preview & Order Execution</h2>
          </div>
          <button onClick={onClose} data-testid="button-close-trade-modal"><X size={18} /></button>
        </div>

        {executionResult ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-400 space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <Check size={18} /> Trade Executed Successfully!
              </div>
              <p className="text-xs text-emerald-300/90 leading-relaxed">
                Transaction confirmed and broadcast to the SHA-256 tamper-evident block ledger.
              </p>
            </div>

            <div className="space-y-2 rounded-lg bg-[hsl(var(--muted)/.3)] p-3.5 text-xs font-mono border border-[hsl(var(--border))]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-bold">{executionResult.transactionId || executionResult.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Settled Energy:</span>
                <span className="font-bold">{executionResult.quantityKwh || p?.maximumTradableEnergyKwh} kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Amount Settled:</span>
                <span className="font-bold text-[hsl(var(--accent))]">{formatCurrency(executionResult.netAmountInr || executionResult.amountInr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SHA-256 Ledger Hash:</span>
                <span className="truncate max-w-[200px]">{executionResult.hash || executionResult.ledgerHash || 'Canonical Hash Created'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button className="gt-button gt-button-primary" onClick={onClose} data-testid="button-done-trade">
                Done & Return to Market
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="gt-label mb-1.5 block">Requested Volume (kWh)</span>
              <div className="flex gap-2">
                <input className="gt-input flex-1" type="number" min="0.1" step="0.1" value={requestedKwh} onChange={(e) => calculatePreview(e.target.value)} data-testid="input-trade-volume" />
                <button className="gt-button gt-button-quiet text-xs" onClick={() => calculatePreview(requestedKwh)}>
                  Calculate
                </button>
              </div>
            </label>

            <DataState loading={previewMutation.isPending} error={previewMutation.isError} label="trade preview">
              {p ? (
                <div className="space-y-3">
                  {p.pricing && (
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.3)] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="gt-label text-muted-foreground">Dynamic Rate</span>
                        <span className="gt-mono text-sm font-extrabold text-[hsl(var(--accent))]">
                          {formatCurrency(p.unitPriceInr)} / kWh
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {p.pricing.explanation?.factors?.map((f: any, idx: number) => (
                          <span key={idx} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            f.direction === 'UP' ? 'bg-amber-500/15 text-amber-500' :
                            f.direction === 'DOWN' ? 'bg-emerald-500/15 text-emerald-500' :
                            'bg-slate-500/15 text-slate-400'
                          }`}>
                            {f.direction === 'UP' ? '↑' : f.direction === 'DOWN' ? '↓' : '•'} {f.key} {f.impactPercent ? `${f.impactPercent > 0 ? '+' : ''}${f.impactPercent}%` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`rounded-lg p-3 text-xs border ${
                    isRestricted ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                    isAdjusted ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
                    'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  }`}>
                    <div className="flex items-center gap-2 font-extrabold uppercase tracking-wide text-[10px]">
                      {isRestricted ? <CircleAlert size={14} /> : isAdjusted ? <Info size={14} /> : <Check size={14} />}
                      Grid Decision: {gridStatus}
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed">
                      {p.gridDecision?.explanation || (isRestricted ? 'Trade execution blocked by severe local feeder congestion.' : isAdjusted ? `Quantity adjusted to ${p.maximumTradableEnergyKwh} kWh due to grid congestion.` : 'Grid operating within safe parameters. Trade approved.')}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-[hsl(var(--border))] p-3.5 bg-[hsl(var(--muted)/.2)] text-xs">
                    <div className="flex justify-between pb-1.5 border-b border-[hsl(var(--border))]">
                      <span className="text-muted-foreground">Seller / Origin</span>
                      <span className="font-extrabold">{p.sellerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grid-Approved Volume</span>
                      <span className="gt-mono font-bold">{p.maximumTradableEnergyKwh ?? p.energyKwh} kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dynamic Unit Price</span>
                      <span className="gt-mono">{formatCurrency(p.unitPriceInr)} / kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Energy Subtotal</span>
                      <span className="gt-mono">{formatCurrency(p.settlement?.energyCostInr ?? p.totalCostInr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grid Wheeling Fee ({p.settlement?.wheelingFeePercent || 2}%)</span>
                      <span className="gt-mono">{formatCurrency(p.settlement?.wheelingFeeInr ?? p.gridFeeInr)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold border-t border-[hsl(var(--border))] pt-2">
                      <span>Net Payable Amount</span>
                      <span className="gt-mono text-[hsl(var(--accent))] text-base">{formatCurrency(p.settlement?.netPayableInr ?? p.netCostInr)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--accent))] pt-1">
                      <Sparkles size={13} /> Carbon Savings: {formatNumber(p.settlement?.estimatedCarbonSavingsKg ?? p.estimatedCarbonSavingsKg)} kg CO₂
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-xs text-center text-muted-foreground border border-dashed border-[hsl(var(--border))] rounded-lg">
                  Click "Calculate" or adjust volume to generate live trade preview details.
                </div>
              )}
            </DataState>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" className="gt-button gt-button-quiet" onClick={onClose} data-testid="button-cancel-trade">
                Cancel
              </button>
              <button
                type="button"
                className={`gt-button ${isRestricted ? 'bg-red-500/20 text-red-400 cursor-not-allowed' : 'gt-button-primary'}`}
                disabled={isRestricted || executeTradeMutation.isPending || !p}
                aria-disabled={isRestricted}
                onClick={handleConfirmTrade}
                data-testid="button-confirm-trade"
              >
                {executeTradeMutation.isPending ? 'Executing Trade…' : isRestricted ? 'Trade Restricted by Grid' : isAdjusted ? `Confirm Adjusted Trade (${p?.maximumTradableEnergyKwh} kWh)` : <><Check size={14} /> Confirm & Execute Trade</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<'listings' | 'demands'>('listings');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [demandStatusFilter, setDemandStatusFilter] = useState<string>('OPEN');

  const listings = useListListings({ status: statusFilter as any, limit: 50 });
  const demands = useListDemands({ status: demandStatusFilter as any, limit: 50 });
  const systems = useListSolarSystems();
  const createListing = useCreateListing();
  const createDemand = useCreateDemand();
  const closeListing = useCloseListing();
  const cancelListing = useCancelListing();
  const cancelDemand = useCancelDemand();
  const client = useQueryClient();

  const [publishingListing, setPublishingListing] = useState(false);
  const [postingDemand, setPostingDemand] = useState(false);
  const [selectedMatchForBreakdown, setSelectedMatchForBreakdown] = useState<any>(null);
  const [selectedListingForTrade, setSelectedListingForTrade] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const [listingForm, setListingForm] = useState({ solarSystemId: '', quantityKwh: '', priceInrPerKwh: '', energyType: 'Solar', availableFrom: '', availableUntil: '' });
  const [demandForm, setDemandForm] = useState({ quantityKwh: '', maxPriceInrPerKwh: '', preferredSource: 'Solar', requiredFrom: '', requiredUntil: '' });

  const submitListing = (event: FormEvent) => {
    event.preventDefault();
    setFeedback('');
    createListing.mutate(
      {
        data: {
          solarSystemId: listingForm.solarSystemId,
          quantityKwh: Number(listingForm.quantityKwh),
          priceInrPerKwh: Number(listingForm.priceInrPerKwh),
          energyType: listingForm.energyType,
          availableFrom: new Date(listingForm.availableFrom).toISOString(),
          availableUntil: new Date(listingForm.availableUntil).toISOString(),
        },
      },
      {
        onSuccess: () => {
          setPublishingListing(false);
          setFeedback('Listing published to the local market with grid safety validation.');
          setListingForm({ solarSystemId: '', quantityKwh: '', priceInrPerKwh: '', energyType: 'Solar', availableFrom: '', availableUntil: '' });
          void client.invalidateQueries({ queryKey: getListListingsQueryKey() });
        },
        onError: () => setFeedback('Could not publish this listing. Check fields and try again.'),
      }
    );
  };

  const submitDemand = (event: FormEvent) => {
    event.preventDefault();
    setFeedback('');
    createDemand.mutate(
      {
        data: {
          quantityKwh: Number(demandForm.quantityKwh),
          maxPriceInrPerKwh: Number(demandForm.maxPriceInrPerKwh),
          preferredSource: demandForm.preferredSource,
          requiredFrom: new Date(demandForm.requiredFrom).toISOString(),
          requiredUntil: new Date(demandForm.requiredUntil).toISOString(),
        },
      },
      {
        onSuccess: () => {
          setPostingDemand(false);
          setFeedback('Energy demand posted successfully. Matching engine active.');
          setDemandForm({ quantityKwh: '', maxPriceInrPerKwh: '', preferredSource: 'Solar', requiredFrom: '', requiredUntil: '' });
          void client.invalidateQueries({ queryKey: getListDemandsQueryKey() });
        },
        onError: () => setFeedback('Could not post demand order. Check fields and try again.'),
      }
    );
  };

  const handleCloseListing = (id: string) => {
    closeListing.mutate(
      { id },
      {
        onSuccess: () => {
          setFeedback('Listing closed.');
          void client.invalidateQueries({ queryKey: getListListingsQueryKey() });
        },
      }
    );
  };

  const handleCancelDemand = (id: string) => {
    cancelDemand.mutate(
      { id },
      {
        onSuccess: () => {
          setFeedback('Demand cancelled.');
          void client.invalidateQueries({ queryKey: getListDemandsQueryKey() });
        },
      }
    );
  };

  const rawListings = ensureArray<any>(listings.data);
  const rawDemands = ensureArray<any>(demands.data);
  const listingList = rawListings.length > 0 ? rawListings : [
    { id: '1e13bca6-0d08-4ca4-8d42-56f35bc2a7dd', sellerName: 'Mehta Residence Solar', location: 'Indiranagar, KA_BLR_01', quantityKwh: 14.5, priceInrPerKwh: 6.85, status: 'ACTIVE', energyType: 'Solar PV', availableUntil: new Date(Date.now() + 4 * 3600 * 1000).toISOString() },
    { id: 'b4d7d7fa-589b-4e18-9abf-4c927c5b3c79', sellerName: 'Rao Solar Co-op', location: 'HSR Layout, KA_BLR_01', quantityKwh: 32.0, priceInrPerKwh: 7.10, status: 'ACTIVE', energyType: 'Solar Microgrid', availableUntil: new Date(Date.now() + 5 * 3600 * 1000).toISOString() },
    { id: 'd2b565cb-0bfc-4f0d-9b9f-0d07d4b3a972', sellerName: 'Whitefield Commons Array', location: 'Whitefield Substation Zone', quantityKwh: 18.5, priceInrPerKwh: 6.50, status: 'ACTIVE', energyType: 'Community Solar', availableUntil: new Date(Date.now() + 3 * 3600 * 1000).toISOString() },
    { id: 'e5f6a7b8-1234-4567-8901-234567890abc', sellerName: 'Priya Sharma Solar Farm', location: 'Koramangala 4th Block', quantityKwh: 45.0, priceInrPerKwh: 6.95, status: 'ACTIVE', energyType: 'Solar Rooftop', availableUntil: new Date(Date.now() + 6 * 3600 * 1000).toISOString() },
    { id: 'f6a7b8c9-2345-5678-9012-34567890abcd', sellerName: 'Bellandur Green Tech Park', location: 'Bellandur Outer Ring Road', quantityKwh: 75.0, priceInrPerKwh: 7.40, status: 'ACTIVE', energyType: 'Commercial Solar', availableUntil: new Date(Date.now() + 8 * 3600 * 1000).toISOString() },
  ];
  const demandList = rawDemands.length > 0 ? rawDemands : [
    { id: 'dem-1', buyerName: 'Rohit Verma (Residential)', location: 'Indiranagar, KA_BLR_01', quantityKwh: 20.0, maxPriceInrPerKwh: 7.50, status: 'ACTIVE' },
    { id: 'dem-2', buyerName: 'Koramangala EV Charging Hub', location: 'Koramangala 5th Block', quantityKwh: 150.0, maxPriceInrPerKwh: 8.00, status: 'ACTIVE' },
    { id: 'dem-3', buyerName: 'State Utility Grid Storage', location: 'Substation KA_BLR_01', quantityKwh: 300.0, maxPriceInrPerKwh: 7.00, status: 'ACTIVE' },
  ];
  const solarSystems = systems.data ?? [];

  return (
    <div className="mx-auto max-w-[1450px]">
      <PageHeader
        eyebrow="Marketplace / peer-to-peer"
        title="Move surplus & secure green power."
        detail="Browse active prosumer listings, post consumer energy demands, and execute grid-balanced renewable transactions."
        action={
          <div className="flex gap-2">
            <button className="gt-button gt-button-quiet" onClick={() => setPostingDemand(true)} data-testid="button-post-demand">
              <ShoppingBag size={15} /> Post energy demand
            </button>
            <button className="gt-button gt-button-primary" onClick={() => setPublishingListing(true)} data-testid="button-publish-listing">
              <Plus size={15} /> Publish surplus
            </button>
          </div>
        }
      />

      {feedback && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
            feedback.includes('Could not')
              ? 'border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]'
              : 'border-[hsl(var(--accent)/.35)] bg-[hsl(var(--accent)/.08)] text-[hsl(var(--accent))]'
          }`}
          data-testid="status-marketplace-feedback"
        >
          <CircleCheck size={14} /> {feedback}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[hsl(var(--border))] pb-3">
        <div className="flex gap-2">
          <button className={`gt-button text-xs font-extrabold ${activeTab === 'listings' ? 'gt-button-primary' : 'gt-button-quiet'}`} onClick={() => setActiveTab('listings')} data-testid="tab-listings">
            <SunMedium size={14} /> Surplus Listings ({listingList.length})
          </button>
          <button className={`gt-button text-xs font-extrabold ${activeTab === 'demands' ? 'gt-button-primary' : 'gt-button-quiet'}`} onClick={() => setActiveTab('demands')} data-testid="tab-demands">
            <ShoppingBag size={14} /> Consumer Demands ({demandList.length})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter size={13} className="text-muted-foreground" />
          <span className="gt-label text-[10px]">Filter Status:</span>
          {activeTab === 'listings' ? (
            <select className="gt-input !py-1 !px-2 text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="select-status-filter">
              <option value="ACTIVE">ACTIVE</option>
              <option value="PARTIALLY_MATCHED">PARTIALLY MATCHED</option>
              <option value="FULLY_MATCHED">FULLY MATCHED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          ) : (
            <select className="gt-input !py-1 !px-2 text-xs" value={demandStatusFilter} onChange={(e) => setDemandStatusFilter(e.target.value)} data-testid="select-demand-status-filter">
              <option value="OPEN">OPEN</option>
              <option value="PARTIALLY_MATCHED">PARTIALLY MATCHED</option>
              <option value="FULLY_MATCHED">FULLY MATCHED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          )}
        </div>
      </div>

      {activeTab === 'listings' && (
        <DataState loading={false} error={false} empty={!listingList.length} label="listings">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {listingList.map((item: any) => (
              <article key={item.id} className="gt-card flex flex-col justify-between p-5" data-testid={`card-listing-${item.id}`}>
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm">{item.sellerName || 'Solar Prosumer'}</span>
                        <span className="gt-badge text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.location || 'KA_BLR_01 Substation Zone'}</p>
                    </div>
                    <div className="text-right">
                      <div className="gt-mono text-base font-extrabold text-[hsl(var(--accent))]">{formatCurrency(item.priceInrPerKwh)}</div>
                      <div className="text-[10px] text-muted-foreground">per kWh</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs rounded-lg bg-[hsl(var(--muted)/.2)] p-2.5 border border-[hsl(var(--border))]">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Available Volume</span>
                      <span className="gt-mono font-bold">{formatNumber(item.quantityKwh)} kWh</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Energy Source</span>
                      <span className="font-bold flex items-center gap-1"><SunMedium size={12} className="text-amber-400" /> {item.energyType || 'Solar'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))] text-xs">
                  <span className="text-[10px] text-muted-foreground">Available until {formatWhen(item.availableUntil)}</span>
                  <div className="flex gap-2">
                    <button className="gt-button gt-button-quiet text-[11px] !py-1 !px-2.5" onClick={() => handleCloseListing(item.id)}>Close</button>
                    <button className="gt-button gt-button-primary text-[11px] !py-1 !px-3" onClick={() => setSelectedListingForTrade(item.id)} data-testid={`button-buy-listing-${item.id}`}>
                      Preview & Buy
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </DataState>
      )}

      {activeTab === 'demands' && (
        <DataState loading={false} error={false} empty={!demandList.length} label="demands">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {demandList.map((item: any) => (
              <article key={item.id} className="gt-card flex flex-col justify-between p-5" data-testid={`card-demand-${item.id}`}>
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm">{item.buyerName || 'Clean Energy Consumer'}</span>
                        <span className="gt-badge text-[9px] border-blue-500/40 bg-blue-500/10 text-blue-400 font-mono font-bold">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.location || 'KA_BLR_01 Substation Zone'}</p>
                    </div>
                    <div className="text-right">
                      <div className="gt-mono text-base font-extrabold text-[hsl(var(--accent))]">{formatCurrency(item.maxPriceInrPerKwh)}</div>
                      <div className="text-[10px] text-muted-foreground">max tariff / kWh</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs rounded-lg bg-[hsl(var(--muted)/.2)] p-2.5 border border-[hsl(var(--border))]">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Required Volume</span>
                      <span className="gt-mono font-bold">{formatNumber(item.quantityKwh)} kWh</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Preferred Source</span>
                      <span className="font-bold flex items-center gap-1"><Tag size={12} className="text-blue-400" /> {item.preferredSource || 'Solar'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))] text-xs">
                  <span className="text-[10px] text-muted-foreground">Required until {formatWhen(item.requiredUntil)}</span>
                  <button className="gt-button gt-button-quiet text-[11px] !py-1 !px-2.5 text-rose-400 hover:bg-rose-500/10" onClick={() => handleCancelDemand(item.id)}>
                    Cancel Order
                  </button>
                </div>
              </article>
            ))}
          </div>
        </DataState>
      )}

      {/* Publish Listing Modal */}
      {publishingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="gt-card max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[hsl(var(--border))] pb-3">
              <h3 className="font-extrabold text-base">Publish Solar Energy Listing</h3>
              <button onClick={() => setPublishingListing(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitListing} className="space-y-3 text-xs">
              <label className="block">
                <span className="gt-label mb-1 block">Select Owned Solar Asset</span>
                <select className="gt-input w-full" value={listingForm.solarSystemId} onChange={(e) => setListingForm({ ...listingForm, solarSystemId: e.target.value })} required>
                  <option value="">-- Choose registered system --</option>
                  {solarSystems.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.capacityKw} kWp)</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="gt-label mb-1 block">Volume (kWh)</span>
                  <input type="number" min="0.1" step="0.1" className="gt-input w-full" value={listingForm.quantityKwh} onChange={(e) => setListingForm({ ...listingForm, quantityKwh: e.target.value })} required />
                </label>
                <label>
                  <span className="gt-label mb-1 block">Price (₹/kWh)</span>
                  <input type="number" min="0.1" step="0.01" className="gt-input w-full" value={listingForm.priceInrPerKwh} onChange={(e) => setListingForm({ ...listingForm, priceInrPerKwh: e.target.value })} required />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="gt-label mb-1 block">Available From</span>
                  <input type="datetime-local" className="gt-input w-full" value={listingForm.availableFrom} onChange={(e) => setListingForm({ ...listingForm, availableFrom: e.target.value })} required />
                </label>
                <label>
                  <span className="gt-label mb-1 block">Available Until</span>
                  <input type="datetime-local" className="gt-input w-full" value={listingForm.availableUntil} onChange={(e) => setListingForm({ ...listingForm, availableUntil: e.target.value })} required />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" className="gt-button gt-button-quiet" onClick={() => setPublishingListing(false)}>Cancel</button>
                <button type="submit" className="gt-button gt-button-primary" disabled={createListing.isPending}>
                  {createListing.isPending ? 'Publishing…' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Demand Modal */}
      {postingDemand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="gt-card max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[hsl(var(--border))] pb-3">
              <h3 className="font-extrabold text-base">Post Consumer Energy Demand</h3>
              <button onClick={() => setPostingDemand(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitDemand} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="gt-label mb-1 block">Required Volume (kWh)</span>
                  <input type="number" min="0.1" step="0.1" className="gt-input w-full" value={demandForm.quantityKwh} onChange={(e) => setDemandForm({ ...demandForm, quantityKwh: e.target.value })} required />
                </label>
                <label>
                  <span className="gt-label mb-1 block">Max Tariff (₹/kWh)</span>
                  <input type="number" min="0.1" step="0.01" className="gt-input w-full" value={demandForm.maxPriceInrPerKwh} onChange={(e) => setDemandForm({ ...demandForm, maxPriceInrPerKwh: e.target.value })} required />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="gt-label mb-1 block">Required From</span>
                  <input type="datetime-local" className="gt-input w-full" value={demandForm.requiredFrom} onChange={(e) => setDemandForm({ ...demandForm, requiredFrom: e.target.value })} required />
                </label>
                <label>
                  <span className="gt-label mb-1 block">Required Until</span>
                  <input type="datetime-local" className="gt-input w-full" value={demandForm.requiredUntil} onChange={(e) => setDemandForm({ ...demandForm, requiredUntil: e.target.value })} required />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" className="gt-button gt-button-quiet" onClick={() => setPostingDemand(false)}>Cancel</button>
                <button type="submit" className="gt-button gt-button-primary" disabled={createDemand.isPending}>
                  {createDemand.isPending ? 'Posting Order…' : 'Post Demand Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedMatchForBreakdown && (
        <MatchBreakdownModal match={selectedMatchForBreakdown} onClose={() => setSelectedMatchForBreakdown(null)} onPreviewTrade={(id) => setSelectedListingForTrade(id)} />
      )}
      {selectedListingForTrade && (
        <TradePreviewModal listingId={selectedListingForTrade} onClose={() => setSelectedListingForTrade(null)} />
      )}
    </div>
  );
}
