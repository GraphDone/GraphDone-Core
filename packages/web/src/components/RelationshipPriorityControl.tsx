import { useId } from 'react';
import {
  relationshipPriorityLevel,
  type RelationshipPriorityLevel,
} from '../lib/relationshipPriority';

export function RelationshipPriorityControl({
  value,
  onChange,
}: {
  value: RelationshipPriorityLevel;
  onChange: (value: RelationshipPriorityLevel) => void;
}) {
  const description = useId();
  return (
    <label
      data-relationship-priority-control="true"
      onClick={event => event.stopPropagation()}
      className="flex min-h-11 max-w-full items-center gap-3 rounded-xl border border-slate-600 bg-slate-900/95 px-3 py-2 text-base text-slate-100 shadow-lg"
      title="Choose relationship priority. Each connected pair keeps its highest available types when no higher-priority type is present."
    >
      Links
      <select
        aria-label="Relationship priority"
        aria-describedby={description}
        value={value}
        onChange={event =>
          onChange(relationshipPriorityLevel(event.target.value))
        }
        className="min-w-0 rounded-lg bg-slate-800 px-2 py-1 text-base font-medium text-white"
      >
        <option value="essential">Essential</option>
        <option value="dependencies">Dependencies</option>
        <option value="all">All</option>
      </select>
      <span id={description} className="sr-only">
        Each connected pair keeps its highest available relationship types.
        Browse connections to inspect every original relationship.
      </span>
    </label>
  );
}
