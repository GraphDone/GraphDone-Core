import { expect, type Page } from '@playwright/test';
import { gql } from './graphRequest';
import { deleteGraphDeep } from './seedGraph';

/** Keep cleanup in a dependency fixture so slow/timed-out seeding cannot consume
 * its timeout slot. Register each graph immediately after its creation. */
export async function ownedGraphIdsFixture(
  { page }: { page: Page },
  use: (ids: string[]) => Promise<void>
): Promise<void> {
  const ids: string[] = [];
  try {
    await use(ids);
  } finally {
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
