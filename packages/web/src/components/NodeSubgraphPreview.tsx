import { useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { Boxes, Maximize2 } from 'lucide-react';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';
import {
  projectSubgraphPreview,
  SUBGRAPH_PREVIEW_ITEMS,
  SUBGRAPH_PREVIEW_EDGES,
} from '../lib/subgraphPreview';
import type { SemanticItem, SemanticEdge } from '../lib/semanticLOD';

interface NodeSubgraphPreviewProps {
  subgraphId: string;
  subgraphName?: string;
  onOpen: () => void;
}

const noItems: SemanticItem[] = [];
const noEdges: SemanticEdge[] = [];

export function NodeSubgraphPreview({
  subgraphId,
  subgraphName,
  onOpen,
}: NodeSubgraphPreviewProps) {
  const itemsQuery = useQuery<{ workItems: SemanticItem[] }>(GET_WORK_ITEMS, {
    variables: {
      where: { graph: { id: subgraphId } },
      options: { limit: SUBGRAPH_PREVIEW_ITEMS },
    },
    fetchPolicy: 'cache-and-network',
  });
  const edgesQuery = useQuery<{ edges: SemanticEdge[] }>(GET_EDGES, {
    variables: {
      where: {
        OR: [
          { source: { graph: { id: subgraphId } } },
          { target: { graph: { id: subgraphId } } },
        ],
      },
      options: { limit: SUBGRAPH_PREVIEW_EDGES },
    },
    fetchPolicy: 'cache-and-network',
  });
  const items = itemsQuery.data?.workItems ?? noItems;
  const edges = edgesQuery.data?.edges ?? noEdges;
  const preview = useMemo(
    () => projectSubgraphPreview(items, edges),
    [items, edges]
  );
  const partialItems = items.length === SUBGRAPH_PREVIEW_ITEMS;
  const partialEdges = edges.length === SUBGRAPH_PREVIEW_EDGES;
  const failed = itemsQuery.error || edgesQuery.error;

  return (
    <section
      data-testid="subgraph-preview"
      aria-label="Diagram preview"
      className="p-3 space-y-4 text-sm font-normal text-slate-200 [overflow-wrap:anywhere]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-50">
          <Boxes
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-teal-300"
          />
          Diagram
        </h2>
        <button
          onClick={onOpen}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 text-sm font-semibold text-teal-100 hover:bg-teal-500/20"
          title={subgraphName ? `Open ${subgraphName}` : 'Open sub-graph'}
        >
          <Maximize2 aria-hidden="true" className="h-5 w-5" />
          Open graph
        </button>
      </div>
      {failed && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100"
        >
          Some diagram data could not load. Open the graph to try again.
        </p>
      )}
      {itemsQuery.loading && !items.length && (
        <p role="status">Loading diagram…</p>
      )}
      {!itemsQuery.loading && !itemsQuery.error && !items.length && (
        <p>This sub-graph is empty.</p>
      )}
      {items.length > 0 && (
        <>
          <p data-preview-counts="true">
            {items.length}
            {partialItems ? '+' : ''} items ·{' '}
            {edgesQuery.loading
              ? 'loading connections…'
              : edgesQuery.error
                ? 'connections unavailable'
                : `${edges.length}${partialEdges ? '+' : ''} connections`}
          </p>
          {(partialItems || partialEdges) && (
            <p className="text-slate-300">
              Partial preview. Open the graph for all details.
            </p>
          )}
          <div className="space-y-3">
            {preview.visibleGroups.map(group => (
              <article
                key={group.id}
                data-preview-group={group.id}
                className="rounded-xl border border-slate-600 bg-slate-800/60 p-3 space-y-2"
              >
                <h3 className="border-l-2 border-teal-300 pl-2 text-base font-semibold text-slate-50">
                  {group.label}
                </h3>
                <p>
                  {group.members.length} items ·{' '}
                  {edgesQuery.loading
                    ? 'loading links…'
                    : edgesQuery.error
                      ? 'links unavailable'
                      : `${group.internalEdges.length} internal links`}
                </p>
                {group.blocked > 0 && (
                  <p className="text-amber-200">{group.blocked} blocked</p>
                )}
                <ul
                  aria-label={`Example items in ${group.label}`}
                  className="space-y-1 text-slate-200"
                >
                  {group.examples.map(item => (
                    <li key={item.id} data-preview-item={item.id}>
                      {item.title}
                    </li>
                  ))}
                </ul>
                {group.members.length > group.examples.length && (
                  <p className="text-slate-300">
                    {group.members.length - group.examples.length} more items in
                    this group
                  </p>
                )}
              </article>
            ))}
          </div>
          {preview.groups.length > preview.visibleGroups.length && (
            <p>
              {preview.groups.length - preview.visibleGroups.length} more groups
              in the full graph
            </p>
          )}
          {!edgesQuery.loading &&
            !edgesQuery.error &&
            preview.visibleConnections.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-50">
                  Connections
                </h3>
                <ol aria-label="Grouped connections" className="space-y-3">
                  {preview.visibleConnections.map(connection => (
                    <li
                      key={connection.id}
                      data-preview-connection={connection.id}
                      className="border-l-2 border-slate-500 pl-3"
                    >
                      <span className="capitalize font-semibold text-teal-100">
                        {connection.type.toLowerCase().replace(/_/g, ' ')} ·{' '}
                        {connection.edges.length}
                      </span>
                      <p>
                        {connection.source === connection.target
                          ? `Within ${connection.sourceLabel}`
                          : `${connection.sourceLabel} → ${connection.targetLabel}`}
                      </p>
                    </li>
                  ))}
                </ol>
                {preview.connections.length >
                  preview.visibleConnections.length && (
                  <p>
                    {preview.connections.length -
                      preview.visibleConnections.length}{' '}
                    more connection groups
                  </p>
                )}
              </div>
            )}
          {preview.pending.length > 0 && (
            <p>
              {preview.pending.length} connections reach items outside this
              preview
            </p>
          )}
        </>
      )}
    </section>
  );
}
