import { useQuery } from '@apollo/client';
import { Bot, RefreshCw } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { GET_WORK_ITEMS } from '../lib/queries';
import { getStatusConfig, type WorkItemStatus } from '../constants/workItemConstants';
import ActivityFeed from '../components/ActivityFeed';
import type { ActivityWorkItem } from '../lib/recordedActivity';

type AgentWork = ActivityWorkItem & { contributors?: { id: string; name: string; type: string }[] };

export function Agents() {
  const { currentGraph, availableGraphs, selectGraph } = useGraph();
  const { data, loading, error, refetch } = useQuery<{ workItems: AgentWork[] }>(GET_WORK_ITEMS, {
    variables: { where: { graph: { id: currentGraph?.id } } }, skip: !currentGraph,
    fetchPolicy: 'cache-and-network', pollInterval: 0,
    skipPollAttempt: () => document.visibilityState !== 'visible',
  });
  const work = (currentGraph ? data?.workItems || [] : []).filter(item => item.contributors?.some(person => person.type === 'AI_AGENT'));
  const agents = new Map(work.flatMap(item => (item.contributors || []).filter(person => person.type === 'AI_AGENT').map(person => [person.id, person])));
  return (
    <div className="h-full min-h-0 overflow-auto p-3 sm:p-6 text-gray-100">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div><h1 className="text-2xl font-semibold">Working with AI</h1><p className="mt-1 text-sm text-gray-400">Follow the work your agents contribute to.</p></div>
        <div className="flex w-full sm:w-auto min-w-0 gap-2">
          <select aria-label="Agent work graph" value={currentGraph?.id || ''} onChange={event => void selectGraph(event.target.value)} className="min-h-[44px] min-w-0 flex-1 max-w-full sm:max-w-[260px] rounded-lg border border-gray-600 bg-gray-800 px-3 text-base">
            {!currentGraph && <option value="">Select a graph</option>}
            {availableGraphs.map(graph => <option key={graph.id} value={graph.id}>{graph.name}</option>)}
          </select>
          <button aria-label="Refresh agent work" disabled={loading || !currentGraph} onClick={() => void refetch().catch(() => {})} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-600 disabled:opacity-50"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </header>
      <p className="mb-5 rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-sm text-gray-300">This view follows recorded AI contributors and their work. Starting agents, automatic work claims, and verified execution history are not available yet.</p>
      {error ? <p role="alert">Could not load agent work. Use refresh to try again.</p> : loading && !data ? <p role="status">Loading agent work…</p> : work.length === 0 ? (
        <section className="rounded-xl border border-gray-700 p-5 sm:p-8">
          <Bot className="mb-3 h-7 w-7 text-emerald-400" /><h2 className="text-lg font-medium">No AI contributions recorded here yet</h2>
          <p className="mt-2 max-w-xl text-sm text-gray-400">When an AI contributor is connected to a work item, its current status and saved notes appear here. The same progress notes are visible in the workspace’s Activity view.</p>
        </section>
      ) : (
        <>
          <p role="status" className="mb-3 text-sm text-gray-400">{agents.size} recorded AI contributors · {work.length} work items</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {work.map(item => <li key={item.id} className="min-w-0 break-words rounded-xl border border-gray-700 p-4">
              <h2 className="font-medium">{item.title}</h2>
              <p className="mt-1 text-sm text-emerald-300">{getStatusConfig(item.status as WorkItemStatus).label}</p>
              <p className="mt-2 text-sm text-gray-400">Contributors: {(item.contributors || []).filter(person => person.type === 'AI_AGENT').map(person => person.name).join(', ')}</p>
            </li>)}
          </ul>
          <ActivityFeed filteredNodes={work} />
        </>
      )}
    </div>
  );
}
