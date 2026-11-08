import {
  ArrowLeft,
  ArrowRight,
  Compass,
  FolderTree,
  List,
  Move,
} from 'lucide-react';
import { GRAPH_FONT_FAMILY } from '../lib/graphSymbolLayout';
import type { LocalItemCard, LocalItemGroup } from '../lib/localItemLOD';
import {
  getStatusConfig,
  getTypeConfig,
  type WorkItemStatus,
  type WorkItemType,
} from '../constants/workItemConstants';

type LocalItemControlsProps =
  | { kind: 'board'; onExplore: () => void }
  | {
      kind: 'items';
      focusTitle: string;
      shownNeighbors: number;
      loadedNeighbors: number;
      previousLabel: string;
      previousDisabled: boolean;
      nextDisabled: boolean;
      onBrowse: (trigger: HTMLButtonElement) => void;
      onPrevious: () => void;
      onNext: () => void;
    };

export function LocalItemControls(props: LocalItemControlsProps) {
  if (props.kind === 'board')
    return (
      <button
        type="button"
        className="flex min-h-11 items-center gap-2 rounded-xl border border-teal-600 bg-slate-900 px-3 text-sm text-teal-100"
        onClick={props.onExplore}
      >
        <Compass size={20} />
        Explore linked items
      </button>
    );
  return (
    <div
      data-lod-controls="true"
      className="flex flex-wrap items-center gap-2"
      aria-label="Local item navigation"
    >
      <button
        type="button"
        className="min-h-11 max-w-full rounded-xl border border-teal-600 bg-slate-900 px-2 text-sm font-semibold text-teal-100"
        title={`Connections around ${props.focusTitle}`}
        onClick={event => props.onBrowse(event.currentTarget)}
      >
        {props.shownNeighbors} / {props.loadedNeighbors} linked
      </button>
      <button
        type="button"
        aria-label={props.previousLabel}
        title={props.previousLabel}
        disabled={props.previousDisabled}
        onClick={props.onPrevious}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 disabled:opacity-40"
      >
        <ArrowLeft size={20} />
      </button>
      <button
        type="button"
        aria-label="Next linked items"
        title="Next linked items"
        disabled={props.nextDisabled}
        onClick={props.onNext}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 disabled:opacity-40"
      >
        <ArrowRight size={20} />
      </button>
    </div>
  );
}

type LocalItemFooterProps = {
  counts: {
    incident: number;
    spatialDeferred: number;
    pending: number;
    internal: number;
    prioritySummarized: number;
  };
  groups: readonly LocalItemGroup[];
  selectedGroup?: string;
  missingGroup: boolean;
  drawn: number;
  routingDeferred: number;
  onBrowseFocus: (trigger: HTMLButtonElement) => void;
  onBrowseAll: (trigger: HTMLButtonElement) => void;
  onGroupChange: (id?: string) => void;
  onEditBoard: () => void;
  onResetGroup: () => void;
};

export function LocalItemFooter({
  counts,
  groups,
  selectedGroup,
  missingGroup,
  drawn,
  routingDeferred,
  onBrowseFocus,
  onBrowseAll,
  onGroupChange,
  onEditBoard,
  onResetGroup,
}: LocalItemFooterProps) {
  return (
    <div
      className="max-w-full rounded-xl border border-slate-600 bg-slate-900/95 px-2 py-1 text-sm text-slate-100 shadow-lg"
      data-graph-fit-obstacle="true"
      data-local-item-status="true"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="min-h-11 flex-1 px-2 text-left font-semibold"
          onClick={event => onBrowseFocus(event.currentTarget)}
        >
          {counts.incident} connections
        </button>
        <button
          type="button"
          aria-label="Browse all graph relationships"
          title="Browse all graph relationships"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600"
          onClick={event => onBrowseAll(event.currentTarget)}
        >
          <List size={20} />
        </button>
        {(groups.length > 1 || selectedGroup) && (
          <label
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-600 focus-within:outline focus-within:outline-2 focus-within:outline-teal-300"
            title="Linked item group"
          >
            <FolderTree size={20} />
            <select
              aria-label="Linked item group"
              value={selectedGroup ?? ''}
              onChange={event => onGroupChange(event.target.value || undefined)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              <option value="">All groups</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.label} · {group.members.length}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          aria-label="Edit saved board positions"
          title="Edit saved board positions"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600"
          onClick={onEditBoard}
        >
          <Move size={20} />
        </button>
      </div>
      {missingGroup && (
        <div role="status" className="px-2 pb-2 text-amber-100">
          <p>The selected group changed.</p>
          <button
            type="button"
            className="min-h-11 underline"
            onClick={onResetGroup}
          >
            Show all linked items
          </button>
        </div>
      )}
      <p className="px-2 text-slate-300">
        {drawn} links shown · {counts.spatialDeferred + routingDeferred} in list
      </p>
      {(counts.pending > 0 ||
        counts.internal > 0 ||
        counts.prioritySummarized > 0) && (
        <p className="px-2 text-slate-300">
          {counts.prioritySummarized} by priority · {counts.internal} internal ·{' '}
          {counts.pending} awaiting endpoints
        </p>
      )}
    </div>
  );
}

type LocalItemCardViewProps = {
  card: LocalItemCard & {
    x: number;
    y: number;
    width: number;
    height: number;
    title: { lines: readonly string[] };
  };
  emphasized: boolean;
  onOpen: () => void;
  onExplore: (trigger: HTMLButtonElement) => void;
};

export function LocalItemCardView({
  card,
  emphasized,
  onOpen,
  onExplore,
}: LocalItemCardViewProps) {
  const config =
    card.kind === 'item'
      ? getTypeConfig(card.item.type as WorkItemType)
      : undefined;
  const Icon = config?.icon ?? FolderTree;
  const status =
    card.kind === 'item'
      ? getStatusConfig(card.item.status as WorkItemStatus)
      : undefined;
  return (
    <section
      data-local-item-card={card.id}
      data-local-kind={card.kind}
      data-original-item={card.kind === 'item' ? card.item.id : undefined}
      className="absolute pointer-events-auto overflow-hidden rounded-xl border bg-slate-900 text-slate-100 shadow-xl"
      style={{
        fontFamily: GRAPH_FONT_FAMILY,
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        borderColor: emphasized ? '#5eead4' : (config?.hexColor ?? '#64748b'),
        outline: emphasized ? '3px solid #5eead4' : undefined,
        outlineOffset: 3,
      }}
    >
      <div
        className="flex h-7 items-center gap-2 border-b border-slate-700 px-3 text-sm font-semibold"
        style={{ color: config?.hexColor ?? '#5eead4' }}
      >
        <Icon size={18} />
        <span>{config?.label ?? 'Linked group'}</span>
        {card.kind === 'item' && card.isFocus && (
          <span className="ml-auto text-slate-200">Focus</span>
        )}
      </div>
      <button
        type="button"
        data-local-open={card.id}
        className="block w-full px-3.5 py-1 text-left text-lg font-semibold leading-6 hover:bg-slate-800 focus:outline focus:outline-2 focus:outline-teal-300"
        title={card.kind === 'item' ? card.item.title : card.label}
        aria-label={
          card.kind === 'item'
            ? `Open ${card.item.title}`
            : `Explore ${card.label}`
        }
        onClick={onOpen}
      >
        {card.title.lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </button>
      <div className="flex h-11 items-center justify-between border-t border-slate-700 pl-3 text-sm text-slate-300">
        <span>
          {card.kind === 'item'
            ? (status?.label ?? card.item.status)
            : `${card.members.length} connected items`}
        </span>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center text-teal-200 hover:bg-slate-800"
          aria-label={
            card.kind === 'item' && card.isFocus
              ? 'Browse focused item connections'
              : card.kind === 'item'
                ? `Focus on ${card.item.title}`
                : `Explore ${card.label}`
          }
          title={
            card.kind === 'item' && card.isFocus
              ? 'Browse focused item connections'
              : 'Explore these connections'
          }
          onClick={event => onExplore(event.currentTarget)}
        >
          <Compass size={20} />
        </button>
      </div>
    </section>
  );
}
