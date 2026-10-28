import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  relationshipEndpoint,
  scopedRelationships,
  relationshipGroupLabel,
  type RelationshipDirection,
  type RelationshipScope,
  type SemanticRelationshipIndex,
} from '../lib/semanticRelationships';

interface Props {
  index: SemanticRelationshipIndex;
  scope: RelationshipScope;
  contextFor: (id: string) => string;
  onScope: (scope: RelationshipScope) => void;
  onInspect: (id: string) => void;
  onBack: () => void;
  focusId?: string;
  visible: boolean;
  backLabel?: string;
  onEdit?: (id: string) => void;
}

export function SemanticRelationshipBrowser({
  index,
  scope,
  contextFor,
  onScope,
  onInspect,
  onBack,
  focusId,
  visible,
  backLabel = 'Back to groups',
  onEdit,
}: Props) {
  const [page, setPage] = useState(0);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<RelationshipDirection>('both');
  const [hops, setHops] = useState<1 | 2>(1);
  const host = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const ownedFocus = useRef<HTMLElement | null>(null);
  const related = useMemo(
    () => scopedRelationships(index, scope, direction, hops),
    [index, scope, direction, hops]
  );
  const types = useMemo(
    () => [...new Set(related.map(edge => edge.type))].sort(),
    [related]
  );
  const rows = useMemo(
    () =>
      related.filter(
        edge =>
          (!type || edge.type === type) &&
          [
            edge.id,
            edge.type,
            relationshipEndpoint(edge.source),
            relationshipEndpoint(edge.target),
            index.byId.get(relationshipEndpoint(edge.source))?.title,
            index.byId.get(relationshipEndpoint(edge.target))?.title,
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase())
      ),
    [index, related, type, search]
  );
  const pageSize = 250;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );
  useEffect(() => {
    setPage(0);
  }, [scope, type, search, direction, hops]);
  const missingGroup =
    scope.kind === 'internal'
      ? !relationshipGroupLabel(index, scope.group)
      : scope.kind === 'bundle'
        ? !relationshipGroupLabel(index, scope.source) ||
          !relationshipGroupLabel(index, scope.target)
        : false;
  const title =
    scope.kind === 'all'
      ? 'All loaded relationships'
      : scope.kind === 'node'
        ? `Relationships of ${index.byId.get(scope.id)?.title ?? scope.id}`
        : scope.kind === 'internal'
          ? `Internal relationships of ${relationshipGroupLabel(index, scope.group) ?? 'unavailable group'}`
          : `${relationshipGroupLabel(index, scope.source) ?? 'Unavailable group'} → ${relationshipGroupLabel(index, scope.target) ?? 'Unavailable group'}: ${scope.type}`;
  useEffect(() => {
    if (!visible) return;
    const focus = Array.from(
      host.current?.querySelectorAll<HTMLButtonElement>('[data-lod-inspect]') ??
        []
    ).find(button => button.dataset.lodInspect === focusId);
    (focus ?? back.current)?.focus();
  }, [scope, focusId, visible]);
  useEffect(() => {
    if (type && !types.includes(type)) setType('');
  }, [type, types]);
  useLayoutEffect(() => {
    if (
      visible &&
      ownedFocus.current &&
      !ownedFocus.current.isConnected &&
      document.activeElement === document.body
    ) {
      ownedFocus.current = null;
      back.current?.focus();
    }
  }, [rows, index, visible]);
  const endpoint = (id: string) => {
    const item = index.byId.get(id);
    return (
      <div className="min-w-0 break-words">
        {item ? (
          <>
            <button
              data-lod-inspect={id}
              aria-label={`Inspect ${item.title}`}
              onClick={() => onInspect(id)}
              className="min-h-11 text-left text-emerald-200 underline break-words"
            >
              {item.title}
            </button>
            <p className="text-sm text-gray-300">{contextFor(id)}</p>
            <button
              aria-label={`Explore relationships of ${item.title}`}
              onClick={() => {
                setType('');
                setSearch('');
                onScope({ kind: 'node', id });
              }}
              className="min-h-11 text-sm text-emerald-200 text-left"
            >
              Explore from here
            </button>
          </>
        ) : (
          <>
            <span>{id}</span>
            <p className="text-sm text-amber-200">Endpoint not loaded</p>
          </>
        )}
        {item && <p className="text-sm text-gray-400 break-all">{id}</p>}
      </div>
    );
  };
  return (
    <section
      ref={host}
      hidden={!visible}
      role="region"
      aria-label="Graph relationships"
      data-lod-controls="true"
      data-graph-fit-obstacle="true"
      onClick={event => event.stopPropagation()}
      onFocusCapture={event => {
        ownedFocus.current = event.target as HTMLElement;
      }}
      onBlurCapture={event => {
        if (event.relatedTarget) ownedFocus.current = null;
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onBack();
        }
      }}
      className="absolute z-30 inset-x-3 top-28 bottom-3 sm:top-16 sm:inset-x-auto sm:left-16 sm:w-96 pointer-events-auto overflow-auto rounded-xl border border-gray-600 bg-gray-950 p-4 text-gray-100 shadow-xl"
    >
      <button
        ref={back}
        onClick={onBack}
        className="min-h-11 text-sm text-emerald-200"
      >
        {backLabel}
      </button>
      <h2 className="text-base font-semibold break-words">{title}</h2>
      {missingGroup && (
        <p className="text-sm text-amber-200 my-2">
          This group is no longer present in the loaded graph.
        </p>
      )}
      <p className="my-2 text-sm text-gray-300">
        Source → target follows the stored relationship direction.
      </p>
      {scope.kind === 'node' && (
        <div className="flex flex-wrap gap-2 my-3">
          <label className="text-sm">
            Relationship direction
            <select
              aria-label="Relationship direction"
              value={direction}
              onChange={event =>
                setDirection(event.target.value as RelationshipDirection)
              }
              className="block w-full min-h-11 rounded border border-gray-600 bg-gray-900 p-2"
            >
              <option value="both">Incoming and outgoing</option>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
          </label>
          <label className="text-sm">
            Neighborhood depth
            <select
              aria-label="Neighborhood depth"
              value={hops}
              onChange={event => setHops(Number(event.target.value) as 1 | 2)}
              className="block min-h-11 rounded border border-gray-600 bg-gray-900 p-2"
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
            </select>
          </label>
        </div>
      )}
      <label className="block text-sm my-3">
        Relationship type
        <select
          aria-label="Relationship type"
          value={type}
          onChange={event => setType(event.target.value)}
          className="block w-full min-h-11 rounded border border-gray-600 bg-gray-900 p-2"
        >
          <option value="">All types</option>
          {types.map(value => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm my-3">
        Find a relationship
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="block w-full min-h-11 rounded border border-gray-600 bg-gray-900 p-2"
        />
      </label>
      <p role="status" className="text-sm my-3">
        {rows.length} of {related.length} relationships
      </p>
      {pageCount > 1 && (
        <nav
          aria-label="Relationship pages"
          className="flex items-center justify-between gap-2 my-3 text-sm"
        >
          <button
            className="min-h-11 px-3 rounded border border-gray-600 disabled:opacity-40"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous relationships
          </button>
          <span>
            {currentPage * pageSize + 1}–
            {Math.min(rows.length, (currentPage + 1) * pageSize)} of{' '}
            {rows.length}
          </span>
          <button
            className="min-h-11 px-3 rounded border border-gray-600 disabled:opacity-40"
            disabled={currentPage + 1 === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next relationships
          </button>
        </nav>
      )}
      <ul className="space-y-3">
        {pageRows.map(edge => (
          <li
            key={edge.id}
            data-lod-edge-id={edge.id}
            className="rounded border border-gray-700 bg-gray-900 p-3"
          >
            <p className="text-sm text-gray-300 break-all">{edge.id}</p>
            {onEdit && (
              <button
                className="min-h-11 text-sm text-emerald-200"
                onClick={() => onEdit(edge.id)}
                aria-label={`Edit relationship ${edge.id}`}
              >
                Edit relationship
              </button>
            )}
            {endpoint(relationshipEndpoint(edge.source))}
            <p className="text-sm font-semibold my-1">→ {edge.type}</p>
            {endpoint(relationshipEndpoint(edge.target))}
          </li>
        ))}
      </ul>
      {rows.length === 0 && (
        <p className="my-3 text-sm text-gray-300">
          No loaded relationships match this view.
        </p>
      )}
    </section>
  );
}
