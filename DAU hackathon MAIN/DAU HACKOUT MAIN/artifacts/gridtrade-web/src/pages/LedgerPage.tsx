import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useListTransactions, useVerifyLedger } from '@workspace/api-client-react';
import { DataState, PageHeader, ensureArray, formatCurrency, formatNumber, formatWhen } from '@/components/common-ui';

export default function LedgerPage() {
  const transactions = useListTransactions();
  const ledgerAudit = useVerifyLedger();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const txList = ensureArray<any>(transactions.data);
  const auditData: any = ledgerAudit.data;

  const handleVerifyTransaction = async (id: string) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/v1/transactions/${id}/verify`);
      const data = await res.json();
      setVerificationResult(data);
    } catch (err: any) {
      alert('Verification failed: ' + err?.message);
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1450px]">
      <PageHeader
        eyebrow="SHA-256 Ledger / Auditable Record"
        title="Tamper-evident cryptographic hash-chain."
        detail="Every completed trade creates a canonical SHA-256 block record linked to the previous block in PostgreSQL."
        action={
          <button className="gt-button gt-button-primary" onClick={() => void ledgerAudit.refetch()} data-testid="button-audit-ledger">
            <ShieldCheck size={15} /> Run Ledger Audit
          </button>
        }
      />

      <DataState loading={ledgerAudit.isLoading} error={ledgerAudit.isError} onRetry={() => void ledgerAudit.refetch()} label="ledger audit">
        <div className={`mb-5 rounded-xl border p-5 ${
          auditData?.verified ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${auditData?.verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold tracking-tight">
                    {auditData?.verified ? 'SHA-256 Cryptographic Hash Chain Intact' : 'Ledger Integrity Audit Status'}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${
                    auditData?.verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {auditData?.verified ? 'Chain Valid' : 'Audit Alert'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {auditData?.verified
                    ? `${auditData.verifiedBlocks || 0} of ${auditData.totalBlocks || 0} blocks verified with 0 cryptographic hash mismatches.`
                    : (auditData?.failureReason || 'Auditing ledger block chain linkage...')}
                </p>
              </div>
            </div>
            <div className="gt-mono text-xs font-bold text-muted-foreground">
              Checked: {formatWhen(auditData?.checkedAt)}
            </div>
          </div>
        </div>
      </DataState>

      <DataState loading={transactions.isLoading} error={transactions.isError} empty={!transactions.isLoading && !txList.length} onRetry={() => void transactions.refetch()} label="transactions">
        <div className="gt-card overflow-hidden p-0">
          <div className="border-b border-[hsl(var(--border))] px-5 py-4 flex items-center justify-between">
            <div>
              <div className="gt-label">Immutable Ledger Blocks</div>
              <h2 className="mt-0.5 text-sm font-extrabold">Confirmed Transactions & SHA-256 Records</h2>
            </div>
            <span className="gt-mono text-xs text-muted-foreground">{txList.length} Blocks Recorded</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.4)] text-[10px] uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Block #</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Buyer → Seller</th>
                  <th className="py-3 px-4">Energy / Rate</th>
                  <th className="py-3 px-4">Net Amount</th>
                  <th className="py-3 px-4">SHA-256 Hash</th>
                  <th className="py-3 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))] font-mono text-[11px]">
                {txList.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-[hsl(var(--muted)/.2)] transition-colors">
                    <td className="py-3 px-4 font-bold text-[hsl(var(--accent))]">#{tx.blockIndex}</td>
                    <td className="py-3 px-4 text-muted-foreground">{formatWhen(tx.settledAt || tx.createdAt)}</td>
                    <td className="py-3 px-4 font-sans font-bold">{tx.buyerName} → {tx.sellerName}</td>
                    <td className="py-3 px-4">{formatNumber(tx.quantityKwh)} kWh @ {formatCurrency(tx.agreedPriceInrPerKwh)}</td>
                    <td className="py-3 px-4 font-bold text-[hsl(var(--accent))]">{formatCurrency(tx.amountInr)}</td>
                    <td className="py-3 px-4 text-[10px] text-muted-foreground truncate max-w-[140px]" title={tx.hash}>
                      {tx.hash ? `${tx.hash.slice(0, 10)}...${tx.hash.slice(-6)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        className="gt-button gt-button-quiet !py-1 !px-2 text-[10px]"
                        onClick={() => handleVerifyTransaction(tx.id)}
                        disabled={verifyingId === tx.id}
                        data-testid={`button-verify-tx-${tx.id}`}
                      >
                        {verifyingId === tx.id ? 'Verifying…' : <><ShieldCheck size={12} /> Verify Hash</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DataState>

      {verificationResult && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--sidebar)/.55)] p-3 sm:items-center">
          <div className="gt-card w-full max-w-[520px] p-5 sm:p-6" role="dialog" aria-modal="true" data-testid="dialog-verification-result">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="gt-label text-[hsl(var(--accent))]">Tamper-Evident SHA-256 Verification</div>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-.04em]">Transaction Audit Result</h2>
              </div>
              <button onClick={() => setVerificationResult(null)} data-testid="button-close-verification"><X size={18} /></button>
            </div>

            <div className={`space-y-3 rounded-xl border p-4 text-xs ${
              verificationResult.verified ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}>
              <div className="flex items-center gap-2 font-extrabold uppercase text-xs">
                <ShieldCheck size={18} />
                Status: {verificationResult.result}
              </div>
              <p className="leading-relaxed">{verificationResult.explanation}</p>
            </div>

            <div className="mt-4 space-y-2 rounded-lg bg-[hsl(var(--muted)/.3)] p-3.5 text-xs font-mono border border-[hsl(var(--border))]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Block Index:</span>
                <span className="font-bold">#{verificationResult.blockIndex ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Persisted Hash:</span>
                <span className="truncate max-w-[220px] font-bold">{verificationResult.hash ?? '—'}</span>
              </div>
              {verificationResult.expectedHash && (
                <div className="flex justify-between text-amber-400">
                  <span>Computed Hash:</span>
                  <span className="truncate max-w-[220px] font-bold">{verificationResult.expectedHash}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground border-t border-[hsl(var(--border))] pt-2">
                <span>Previous Block Hash:</span>
                <span className="truncate max-w-[220px]">{verificationResult.previousHash ?? 'GENESIS'}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button className="gt-button gt-button-primary" onClick={() => setVerificationResult(null)} data-testid="button-done-verification">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
