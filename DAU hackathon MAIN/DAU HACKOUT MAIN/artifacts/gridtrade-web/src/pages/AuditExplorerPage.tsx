import { Clock3 } from 'lucide-react';
import { useGetActivityFeed } from '@workspace/api-client-react';
import { ActivityList, PageHeader, ensureArray } from '@/components/common-ui';

export default function AuditExplorerPage() {
  const { data: activityData } = useGetActivityFeed({ limit: 20 });
  const events = ensureArray<any>(activityData);

  return (
    <div className="mx-auto max-w-[1450px] space-y-6">
      <PageHeader
        eyebrow="Audit Trail / Immutable History"
        title="Audit Explorer — Complete Platform Event Stream"
        detail="Chronological audit log tracking grid decisions, trade matches, ledger commits, and simulation triggers."
        action={
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold">
            <Clock3 size={14} className="text-[hsl(var(--accent))]" />
            Audit Log Stream
          </div>
        }
      />

      <div className="gt-card p-5 space-y-4">
        <ActivityList events={events} />
      </div>
    </div>
  );
}
