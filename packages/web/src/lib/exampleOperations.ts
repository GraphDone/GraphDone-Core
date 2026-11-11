/**
 * Every write the example workspace makes, by GraphQL operation name. Nothing
 * else uses these names, so a view that must not write (and its tests) can let
 * the example finish in the background and still count every other write.
 * GraphContext's tests check that the example sends no write outside this list.
 */
export const EXAMPLE_WRITE_OPERATIONS = [
  'CreateStarterGraphs',
  'CreateStarterItems',
  'CreateStarterEdges',
  'DeleteStarterContent',
  'UpdateStarterGraph',
  'DeleteStarterGraph',
] as const;

export const isExampleWrite = (operationName: string | null | undefined): boolean =>
  !!operationName && (EXAMPLE_WRITE_OPERATIONS as readonly string[]).includes(operationName);
