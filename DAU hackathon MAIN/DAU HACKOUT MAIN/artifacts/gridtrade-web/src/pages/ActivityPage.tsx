import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useGetActivityFeed } from '@workspace/api-client-react';
import { ActivityList, DataState, PageHeader, ensureArray } from '@/components/common-ui';

export default function ActivityPage() {
  const [limit, setLimit] = useState(20);
  const events = useGetActivityFeed({ limit });
  const eventList = ensureArray<any>(events.data);
  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        eyebrow="Activity / persisted events"
        title="The record of every decision."
        detail="A durable timeline of listings, matches, grid instructions, transactions, and model alerts across your workspace."
        action={
          <button className="gt-button gt-button-quiet" onClick={() => void events.refetch()} data-testid="button-refresh-activity">
            <RefreshCw size={14} /> Refresh feed
          </button>
        }
      />
      <section className="gt-card p-4 sm:p-6">
        <div className="mb-2 flex items-center justify-between border-b border-[hsl(var(--border))] pb-4">
          <div className="gt-label">Latest events</div>
          <div className="gt-mono text-[10px] text-muted-foreground">{eventList.length} loaded</div>
        </div>
        <DataState loading={events.isLoading} error={events.isError} empty={!events.isLoading && !eventList.length} onRetry={() => void events.refetch()} label="activity events">
          <ActivityList events={eventList} />
        </DataState>
        {eventList.length === limit && (
          <button
            className="mt-4 w-full rounded-lg border border-dashed border-[hsl(var(--border))] py-3 text-[11px] font-extrabold text-muted-foreground hover:bg-[hsl(var(--muted)/.5)]"
            onClick={() => setLimit((current) => Math.min(50, current + 10))}
            data-testid="button-load-more-activity"
          >
            Load older events
          </button>
        )}
      </section>
    </div>
  );
}
