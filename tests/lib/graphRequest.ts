import type { Page } from '@playwright/test';

export async function gql(page: Page, query: string, variables: unknown = {}) {
  return page.evaluate(async ({ query, variables }) => {
    const response = await fetch('/api/graphql', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` },
      body: JSON.stringify({ query, variables }),
    });
    const body = await response.json();
    if (body.errors) throw new Error(body.errors.map((e: {message: string}) => e.message).join('; '));
    return body.data;
  }, { query, variables });
}

