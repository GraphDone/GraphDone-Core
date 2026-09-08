import { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  RefreshCw,
  Search,
  Target,
} from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { TaskDistributionRadar } from '../components/TaskDistributionRadar';
import { GET_WORK_ITEMS } from '../lib/queries';
import {
  boundedPriority,
  summarizeGraph,
  type AnalyticsItem,
} from '../lib/graphAnalytics';
import {
  getStatusConfig,
  type WorkItemStatus,
} from '../constants/workItemConstants';

export function Analytics() {
  const { currentGraph, availableGraphs, selectGraph } = useGraph();
  const [tab, setTab] = useState('overview');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const { data, loading, error, refetch } = useQuery<{
    workItems: AnalyticsItem[];
  }>(GET_WORK_ITEMS, {
    variables: { where: { graph: { id: currentGraph?.id } } },
    skip: !currentGraph?.id,
    fetchPolicy: 'cache-and-network',
    pollInterval: 0,
    skipPollAttempt: () => document.visibilityState !== "visible",
    notifyOnNetworkStatusChange: true,
  });
  const items = currentGraph ? data?.workItems || [] : [];
  const summary = useMemo(() => summarizeGraph(items), [items]);
  const visibleItems = items.filter(
    i =>
      (status === 'all' || i.status === status) &&
      i.title.toLowerCase().includes(search.toLowerCase())
  );
  const card = 'rounded-xl border border-gray-700/60 bg-gray-900/70 p-4 sm:p-6';

  return (
    <div
      className="h-full min-h-0 flex flex-col text-gray-100"
      data-testid="live-analytics"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700/40 p-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Your graph, in motion</h1>
          <p className="text-sm text-gray-400 mt-1 break-words">
            {currentGraph?.name || 'Select a graph'} · Live work snapshot
          </p>
        </div>
        <div className="flex w-full sm:w-auto min-w-0 items-center gap-2">
          <select aria-label="Analytics graph" value={currentGraph?.id || ''}
            onChange={event => { setStatus('all'); setSearch(''); void selectGraph(event.target.value); }}
            className="flex-1 min-w-0 max-w-full sm:max-w-[260px] min-h-[44px] rounded-lg border border-gray-600 bg-gray-800 px-3 text-base">
            {!currentGraph && <option value="">Select a graph</option>}
            {availableGraphs.map(graph => <option key={graph.id} value={graph.id}>{graph.name}</option>)}
          </select>
          <button
            type="button"
            onClick={() => void refetch().catch(() => {})}
            disabled={loading || !currentGraph}
            aria-label="Refresh analytics"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-600 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`}
            />
          </button>
        </div>
      </header>
      <nav
        aria-label="Analytics views"
        className="grid grid-cols-2 sm:flex gap-1 shrink-0 border-b border-gray-700/40 px-4 py-2"
      >
        {['overview', 'work', 'collaboration', 'distribution'].map(value => (
          <button
            key={value}
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`min-h-[44px] shrink-0 rounded-lg px-2 sm:px-4 text-sm capitalize ${tab === value ? 'bg-emerald-500/15 text-emerald-300' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            {value}
          </button>
        ))}
      </nav>
      <section aria-label="Analytics results" className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 space-y-4">
        {!currentGraph ? (
          <p>Select a graph to explore its progress.</p>
        ) : error ? (
          <div role="alert" className={card}>
            <p>Could not load this graph’s analytics.</p>
            <button
              className="min-h-[44px] text-emerald-300 underline"
              onClick={() => void refetch().catch(() => {})}
            >
              Try again
            </button>
          </div>
        ) : loading && !data ? (
          <p role="status">Loading your graph…</p>
        ) : items.length === 0 ? (
          <div className={`${card} text-center py-10`}>
            <Activity className="mx-auto mb-3 text-emerald-400" />
            <h2 className="text-xl font-semibold">
              Every graph starts with an idea
            </h2>
            <p className="mt-2 text-gray-400">
              Create your first work item to see progress here.
            </p>
            <Link
              to="/"
              className="inline-flex items-center min-h-[44px] mt-4 rounded-lg bg-emerald-700 px-5"
            >
              Open workspace
            </Link>
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    ['Work items', summary.total, Target],
                    ['Completed', summary.completed, CheckCircle2],
                    ['Blocked', summary.blocked, Activity],
                    [
                      'Average priority',
                      `${Math.round(summary.averagePriority * 100)}%`,
                      Target,
                    ],
                  ].map(([label, value, Icon]) => {
                    const MetricIcon = Icon as typeof Target;
                    return (
                      <div key={String(label)} className={card}>
                        <MetricIcon className="h-5 w-5 text-emerald-400 mb-3" />
                        <p className="text-sm text-gray-400">{String(label)}</p>
                        <p
                          className="text-3xl font-semibold mt-1"
                          data-testid={`metric-${String(label).toLowerCase().replace(/ /g, '-')}`}
                        >
                          {String(value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <section className={card}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                      Look how far you’ve come
                    </h2>
                    <span className="text-emerald-300">
                      {summary.completed} of {summary.total} complete
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Completed work"
                    aria-valuemin={0}
                    aria-valuemax={summary.total}
                    aria-valuenow={summary.completed}
                    className="h-3 overflow-hidden rounded-full bg-gray-700 mt-4"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-400 motion-safe:transition-all motion-safe:duration-500"
                      style={{ width: `${summary.completion * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {Object.entries(summary.statuses).map(([value, count]) => (
                      <button
                        key={value}
                        onClick={() => {
                          setStatus(value);
                          setTab('work');
                        }}
                        className="min-h-[44px] rounded-full border border-gray-600 px-3 text-sm hover:border-emerald-400"
                      >
                        {getStatusConfig(value as WorkItemStatus).label}{' '}
                        <span className="text-emerald-300 ml-1">{count}</span>
                      </button>
                    ))}
                  </div>
                </section>
                <section className={card}>
                  <h2 className="text-lg font-semibold mb-3">
                    What matters next
                  </h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Highest-priority unfinished work in this graph.
                  </p>
                  {summary.priorities.length ? (
                    <ul className="divide-y divide-gray-700/50">
                      {summary.priorities.slice(0, 5).map(i => (
                        <li
                          key={i.id}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <span className="min-w-0 break-words">
                            {i.title}
                            <span className="block text-sm text-gray-400">
                              {
                                getStatusConfig(i.status as WorkItemStatus)
                                  .label
                              }
                            </span>
                          </span>
                          <span className="text-emerald-300 shrink-0">
                            {Math.round(boundedPriority(i.priority) * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-emerald-300">
                      Nothing unfinished. Take a moment to celebrate.
                    </p>
                  )}
                  <Link
                    to="/"
                    className="inline-flex items-center min-h-[44px] mt-3 text-emerald-300 underline"
                  >
                    Continue in workspace
                  </Link>
                </section>
              </>
            )}
            {tab === 'work' && (
              <section className={card}>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <label className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      aria-label="Search work items"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Find work…"
                      className="w-full min-h-[44px] rounded-lg bg-gray-800 border border-gray-600 pl-9 pr-3 text-base"
                    />
                  </label>
                  <select
                    aria-label="Filter by status"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="max-w-full min-h-[44px] rounded-lg bg-gray-800 border border-gray-600 px-3"
                  >
                    <option value="all">All statuses</option>
                    {Object.keys(summary.statuses).map(s => (
                      <option key={s} value={s}>
                        {getStatusConfig(s as WorkItemStatus).label}
                      </option>
                    ))}
                  </select>
                </div>
                <p role="status" className="text-sm text-gray-400 mb-3">
                  {visibleItems.length} matching work items
                </p>
                <ul className="divide-y divide-gray-700/50">
                  {visibleItems.map(i => (
                    <li
                      key={i.id}
                      className="flex flex-wrap justify-between gap-2 py-3"
                    >
                      <span className="min-w-0 break-words">{i.title}</span>
                      <span className="text-sm text-gray-400">
                        {getStatusConfig(i.status as WorkItemStatus).label} ·{' '}
                        {Math.round(boundedPriority(i.priority) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {tab === 'collaboration' && (
              <section className={card}>
                <h2 className="text-lg font-semibold">
                  People and agents behind the work
                </h2>
                <p className="text-sm text-gray-400 mt-1 mb-4">
                  Work items with recorded contributors. This does not measure
                  presence or votes.
                </p>
                {summary.contributors.length ? (
                  <ul className="divide-y divide-gray-700/50">
                    {summary.contributors.map(p => (
                      <li
                        key={p.id}
                        className="flex justify-between gap-3 py-3"
                      >
                        <span className="min-w-0 break-words">
                          {p.name}
                          <span className="block text-sm text-gray-400">
                            {p.type}
                          </span>
                        </span>
                        <span className="shrink-0 text-emerald-300">
                          {p.items} items
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No contributors have been recorded on these work items yet.
                  </p>
                )}
              </section>
            )}
            {tab === 'distribution' && (
              <section className={`${card} min-w-0 overflow-hidden`}>
                <h2 className="text-lg font-semibold mb-4">Work by status</h2>
                <TaskDistributionRadar />
              </section>
            )}
          </>
        )}
      </section>
    </div>
  );
}
