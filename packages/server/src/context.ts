import { Driver } from 'neo4j-driver';

export interface Context {
  driver?: Driver;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  isNeo4jAvailable?: boolean;
}

export async function createContext({ driver }: { driver?: Driver }): Promise<Context> {
  return {
    driver,
    user: undefined, // TODO: Implement authentication
    isNeo4jAvailable: !!driver,
  };
}

