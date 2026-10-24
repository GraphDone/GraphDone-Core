import { describe, it, expect } from 'vitest';
import {
  isValidWorkItemType, isValidRelationshipType, getTypeConfig, getRelationshipConfig,
  WORK_ITEM_TYPES, RELATIONSHIP_TYPES,
} from '../workItemConstants';

describe('ontology layer: REQUIREMENT type + SATISFIES edge (#27)', () => {
  it('REQUIREMENT is a valid work item type with a config', () => {
    expect(isValidWorkItemType('REQUIREMENT')).toBe(true);
    const cfg = getTypeConfig('REQUIREMENT' as any);
    expect(cfg.label).toBe('Requirement');
    expect(cfg.value).toBe('REQUIREMENT');
    expect(cfg.hexColor).toMatch(/^#/);
    expect(WORK_ITEM_TYPES.REQUIREMENT).toBeTruthy();
  });

  it('SATISFIES is a valid relationship type with a config', () => {
    expect(isValidRelationshipType('SATISFIES')).toBe(true);
    const cfg = getRelationshipConfig('SATISFIES' as any);
    expect(cfg.label).toBe('Satisfies');
    expect(cfg.type).toBe('SATISFIES');
    expect(RELATIONSHIP_TYPES.SATISFIES).toBeTruthy();
  });

  it('isValidRelationshipType rejects unknown types', () => {
    expect(isValidRelationshipType('NONSENSE')).toBe(false);
  });
});
