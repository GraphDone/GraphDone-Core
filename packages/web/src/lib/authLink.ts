import { setContext } from '@apollo/client/link/context';
import { getToken, getUserRaw } from './authStorage';

export const authLink = setContext((_, { headers, expectedOwnerId }) => {
  const token = getToken();
  if (expectedOwnerId !== undefined) {
    let ownerId: string | undefined;
    try { ownerId = JSON.parse(getUserRaw() || 'null')?.id; } catch {}
    if (!token || ownerId !== expectedOwnerId) throw new Error('The signed-in owner changed before this layout could be saved.');
  }
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});
