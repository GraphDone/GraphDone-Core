import { setContext } from '@apollo/client/link/context';
import { getToken, getSessionOwnerId } from './authStorage';

export const authLink = setContext((_, { headers, expectedOwnerId }) => {
  const token = getToken();
  if (expectedOwnerId !== undefined && getSessionOwnerId(token) !== expectedOwnerId) {
    throw new Error('The signed-in owner changed before this layout could be saved.');
  }
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});
