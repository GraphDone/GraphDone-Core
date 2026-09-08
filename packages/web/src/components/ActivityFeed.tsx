import { useMemo, useState } from 'react';
import { Clock, MessageSquare, Search } from 'lucide-react';
import { recordedActivity, type ActivityWorkItem } from '../lib/recordedActivity';
import { getStatusConfig, type WorkItemStatus } from '../constants/workItemConstants';

export default function ActivityFeed({ filteredNodes }: { filteredNodes: ActivityWorkItem[] }) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [limit, setLimit] = useState(30);
  const activities = useMemo(() => recordedActivity(filteredNodes), [filteredNodes]);
  const visible = activities.filter(event => (kind === 'all' || event.kind === kind) &&
    `${event.itemTitle} ${event.text}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="min-h-full min-w-0 p-3 sm:p-6" aria-label="Recorded activity">
      <header className="mb-4">
        <h2 className="text-xl font-semibold text-gray-100">What changed</h2>
        <p className="mt-1 text-sm text-gray-400">Saved work and progress notes from this graph.</p>
        <p className="mt-2 text-xs text-gray-400">Shows creation, the latest update, and editable notes. Full change history and actor attribution are not yet recorded.</p>
      </header>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <label className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
          <input aria-label="Search recorded activity" placeholder="Search work and notes" value={search}
            onChange={event => { setSearch(event.target.value); setLimit(30); }}
            className="min-h-[44px] w-full rounded-lg border border-gray-600 bg-gray-800 pl-10 pr-3 text-base text-gray-100" />
        </label>
        <select aria-label="Activity kind" value={kind} onChange={event => { setKind(event.target.value); setLimit(30); }}
          className="min-h-[44px] rounded-lg border border-gray-600 bg-gray-800 px-3 text-base text-gray-100">
          <option value="all">All recorded activity</option><option value="note">Progress notes</option>
          <option value="created">Created work</option><option value="updated">Latest updates</option>
        </select>
      </div>
      <p role="status" className="mb-3 text-sm text-gray-400">{visible.length} recorded entries</p>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-gray-700 p-6 text-gray-300">
          <MessageSquare className="mb-3 h-6 w-6 text-emerald-400" />
          <h3 className="font-medium">{search || kind !== 'all' ? 'No matching updates' : 'A place to follow the work'}</h3>
          <p className="mt-2 text-sm text-gray-400">Open a work item’s editor and add a progress note to share what happened or what needs attention.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {visible.slice(0, limit).map(event => (
            <li key={event.id} className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 break-words">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <span className="inline-flex items-center gap-2">{event.kind === 'note' ? <MessageSquare className="h-4 w-4 text-emerald-400" /> : <Clock className="h-4 w-4" />}{event.kind === 'note' ? 'Progress note' : event.text}</span>
                <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleString()}</time>
              </div>
              <h3 className="mt-2 font-medium text-gray-100">{event.itemTitle}</h3>
              {event.kind === 'note' && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">{event.text}</p>}
              <p className="mt-2 text-xs text-gray-400">Current status: {getStatusConfig(event.status as WorkItemStatus).label}</p>
            </li>
          ))}
        </ol>
      )}
      {visible.length > limit && <button onClick={() => setLimit(value => value + 30)} className="mt-4 min-h-[44px] rounded-lg border border-gray-600 px-4 text-gray-100">Show more updates</button>}
    </section>
  );
}
