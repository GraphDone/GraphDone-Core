import { expect, type Page } from '@playwright/test';
import { gql } from './graphRequest';
import {
  deleteGraphDeep,
  seedLargeGraph,
  type SeedOptions,
  type SeededGraph,
} from './seedGraph';

export interface OwnedGraphs {
  seed: (
    options: Omit<SeedOptions, 'onGraphCreated' | 'signal'>
  ) => Promise<SeededGraph>;
}

/** Keep cleanup in a dependency fixture so slow/timed-out seeding cannot consume
 * its timeout slot. Register each graph immediately after its creation. */
export async function ownedGraphIdsFixture(
  { page }: { page: Page },
  use: (owner: OwnedGraphs) => Promise<void>
): Promise<void> {
  const ids: string[] = [];
  const controller = new AbortController();
  const pending = new Set<Promise<SeededGraph>>();
  const owner: OwnedGraphs = {
    seed(options) {
      controller.signal.throwIfAborted();
      const task = seedLargeGraph(page, {
        ...options,
        signal: controller.signal,
        onGraphCreated: id => ids.push(id),
      });
      pending.add(task);
      void task.then(
        () => pending.delete(task),
        () => pending.delete(task)
      );
      return task;
    },
  };
  try {
    await use(owner);
  } finally {
    // Playwright's timeout does not cancel async setup. Stop later batches, then
    // drain in-flight responses before taking the ownership snapshot. Never
    // abort a create response and lose the server-generated graph ID.
    controller.abort();
    await Promise.allSettled([...pending]);
    await page.unroute('**/api/graphql');
    const cleanup = await Promise.allSettled(
      ids.map(async id => {
        await deleteGraphDeep(page, id, { strict: true });
        const result = await gql(
          page,
          'query($id:ID!){graphs(where:{id:$id}){id}}',
          { id }
        );
        expect(result.graphs).toEqual([]);
      })
    );
    const failures = cleanup.filter(result => result.status === 'rejected');
    if (failures.length)
      throw new AggregateError(
        failures.map(result => result.reason),
        'Owned graph cleanup failed'
      );
  }
}
