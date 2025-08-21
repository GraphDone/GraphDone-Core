import { Driver } from 'neo4j-driver';
import { Neo4jGraph } from '@graphdone/core';

export interface Context {
  driver: Driver;
  neo4jGraph: Neo4jGraph;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export async function createContext({ driver }: { driver: Driver }): Promise<Context> {
  const neo4jGraph = new Neo4jGraph(driver);
  
  return {
    driver,
    neo4jGraph,
    user: undefined, // TODO: Implement authentication
  };
}

