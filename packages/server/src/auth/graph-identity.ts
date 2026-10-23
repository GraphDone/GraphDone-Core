import type {Driver} from 'neo4j-driver';

interface AccountProfile {
  id: string; email: string; username: string; name: string; role: string;
  isActive: boolean; isEmailVerified: boolean;
}
const profiles = new Map<string, {signature: string; expires: number; pending: Promise<void>}>();

/** Project authenticated SQLite identities into the graph for ownership and assignment.
 * Passwords/tokens stay in SQLite. Authorization still checks the current SQLite account
 * on every request; this bounded cache is only for graph profile synchronization.
 */
export async function ensureGraphIdentity(driver: Driver, account: AccountProfile): Promise<void> {
  const profile = {id: account.id, email: account.email, username: account.username,
    name: account.name, role: account.role, isActive: account.isActive,
    isEmailVerified: account.isEmailVerified};
  const signature = JSON.stringify(profile), existing = profiles.get(account.id);
  if (existing?.signature === signature && existing.expires > Date.now()) return existing.pending;
  if (profiles.size >= 256) profiles.delete(profiles.keys().next().value!);
  const pending = (async () => {
    const session = driver.session();
    try {
      await session.run(`MERGE (u:User {id: $profile.id})
        ON CREATE SET u.createdAt = datetime()
        SET u += $profile, u.updatedAt = datetime()`, {profile});
    } finally { await session.close(); }
  })();
  const entry = {signature, expires: Date.now() + 120_000, pending};
  profiles.set(account.id, entry);
  try { await pending; } catch (error) {
    if (profiles.get(account.id) === entry) profiles.delete(account.id);
    throw error;
  }
}
