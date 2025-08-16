import { PrismaClient } from '@prisma/client';
import { Graph } from '@graphdone/core';

export interface Context {
  prisma: PrismaClient;
  graph: Graph;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

const graph = new Graph();

export async function createContext({ req }: { req: any }): Promise<Context> {
  const authHeader = req.headers.authorization;
  let user = undefined;
  
  if (authHeader) {
    try {
      user = await validateToken(authHeader);
    } catch (error) {
      console.warn('Invalid auth token:', error);
    }
  }

  return {
    prisma,
    graph,
    user,
  };
}

async function validateToken(authHeader: string) {
  // TODO: Implement real token validation
  // For now, just return a demo user
  authHeader.replace('Bearer ', ''); // Extract token when implemented
  
  return {
    id: 'demo-user',
    email: 'demo@example.com',
    name: 'Demo User',
  };
}