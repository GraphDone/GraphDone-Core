import { describe, expect, it } from 'vitest';
import { projectDeleteBlock } from './workspaceRules';

describe('deleting a project', () => {
  const project = { id: 'p', name: 'Getting started', parentGraphId: null };
  const inside = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `g${i}`, name: `Graph ${i}`, parentGraphId: 'p' }));

  it('is refused while graphs sit inside it, naming the project and how many', () => {
    expect(projectDeleteBlock(project, [project, ...inside(4)])).toBe('Getting started holds 4 graphs. Delete or move them first.');
    expect(projectDeleteBlock(project, [project, ...inside(1)])).toBe('Getting started holds 1 graph. Delete or move them first.');
  });

  it('is allowed once nothing sits inside it', () => {
    expect(projectDeleteBlock(project, [project])).toBeNull();
    expect(projectDeleteBlock(project, [project, { id: 'x', name: 'Elsewhere', parentGraphId: 'other' }])).toBeNull();
    expect(projectDeleteBlock({ id: 'g0', name: 'Graph 0', parentGraphId: 'p' }, [project, ...inside(2)])).toBeNull();
  });
});
