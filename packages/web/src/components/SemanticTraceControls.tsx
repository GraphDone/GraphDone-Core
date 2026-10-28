import type { SemanticTraceSelection } from '../lib/semanticTrace';

interface Props {
  selection: SemanticTraceSelection;
  label?: string;
  page: number;
  pages: number;
  shownNeighbors: number;
  totalNeighbors: number;
  hasRoom: boolean;
  drawn: number;
  total: number;
  onChange: (selection: SemanticTraceSelection) => void;
  onExit: () => void;
}

export function SemanticTraceControls({
  selection,
  label,
  page,
  pages,
  shownNeighbors,
  totalNeighbors,
  hasRoom,
  drawn,
  total,
  onChange,
  onExit,
}: Props) {
  const opposite = selection.direction === 'outgoing' ? 'incoming' : 'outgoing';
  return (
    <section
      role="region"
      aria-label="Connection trace"
      data-lod-trace="true"
      data-lod-controls="true"
      data-graph-fit-obstacle="true"
      className="absolute left-3 right-3 bottom-16 sm:left-16 sm:right-auto sm:w-96 h-32 pointer-events-auto rounded-lg border border-emerald-700 bg-gray-950 px-3 py-2 text-xs text-gray-100"
    >
      <h2
        className="truncate text-sm font-semibold text-emerald-100"
        title={label}
      >
        {selection.direction === 'incoming' ? 'Incoming' : 'Outgoing'} ·{' '}
        {label ?? 'Unavailable group'}
      </h2>
      <div className="flex items-center gap-2">
        <button
          className="min-h-11 text-emerald-200"
          aria-label={`Trace ${opposite} connections`}
          onClick={() =>
            onChange({ ...selection, direction: opposite, page: 0 })
          }
        >
          {opposite === 'incoming' ? 'Incoming' : 'Outgoing'}
        </button>
        <button
          className="min-h-11 min-w-11 disabled:opacity-40"
          aria-label="Previous connected groups"
          disabled={page === 0}
          onClick={() => onChange({ ...selection, page: page - 1 })}
        >
          ←
        </button>
        <span>
          {page + 1}/{pages}
        </span>
        <button
          className="min-h-11 min-w-11 disabled:opacity-40"
          aria-label="Next connected groups"
          disabled={page + 1 >= pages}
          onClick={() => onChange({ ...selection, page: page + 1 })}
        >
          →
        </button>
        <button
          className="min-h-11 ml-auto text-emerald-200"
          aria-label="Exit connection trace"
          onClick={onExit}
        >
          All wiring
        </button>
      </div>
      <p>
        {drawn} of {total} relationships drawn · {total - drawn} not drawn
      </p>
      <p className="text-gray-300">
        {!label
          ? 'This group is no longer present.'
          : !hasRoom
            ? 'More room is needed. All connections remain in the list.'
            : `${shownNeighbors} of ${totalNeighbors} connected groups · original direction`}
      </p>
    </section>
  );
}
