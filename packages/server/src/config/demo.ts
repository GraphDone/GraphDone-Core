/**
 * Demo Mode Configuration
 *
 * Configuration for running GraphDone in demo mode with:
 * - Limited concurrent users
 * - Session timeouts
 * - Resource restrictions
 * - Daily resets
 */

export interface DemoConfig {
  enabled: boolean;
  maxConcurrentUsers: number;
  sessionTimeoutMinutes: number;
  maxGraphsPerUser: number;
  maxNodesPerGraph: number;
  maxTeamSize: number;
  allowSignup: boolean;
  allowOAuth: boolean;
  resetSchedule: string; // Cron format
  leadCaptureApiUrl?: string;
}

export const demoConfig: DemoConfig = {
  // Enable demo mode via environment variable
  enabled: process.env.DEMO_MODE === 'true',

  // Maximum concurrent users allowed in demo
  maxConcurrentUsers: parseInt(process.env.DEMO_MAX_USERS || '20', 10),

  // Session timeout in minutes (2 hours default)
  sessionTimeoutMinutes: parseInt(process.env.DEMO_SESSION_TIMEOUT || '120', 10),

  // Maximum graphs per user in demo mode
  maxGraphsPerUser: parseInt(process.env.DEMO_MAX_GRAPHS || '5', 10),

  // Maximum nodes per graph in demo mode
  maxNodesPerGraph: parseInt(process.env.DEMO_MAX_NODES || '50', 10),

  // Maximum team size in demo mode
  maxTeamSize: parseInt(process.env.DEMO_MAX_TEAM_SIZE || '10', 10),

  // Allow user signups in demo mode
  allowSignup: process.env.DEMO_ALLOW_SIGNUP !== 'false',

  // Allow OAuth providers in demo mode
  allowOAuth: process.env.DEMO_ALLOW_OAUTH === 'true',

  // Daily reset schedule (2 AM UTC by default)
  resetSchedule: process.env.DEMO_RESET_SCHEDULE || '0 2 * * *',

  // Lead capture API URL (GraphDone-Website endpoint)
  leadCaptureApiUrl: process.env.LEAD_CAPTURE_API_URL,
};

/**
 * Check if demo mode is enabled
 */
export function isDemoMode(): boolean {
  return demoConfig.enabled;
}

/**
 * Get demo mode configuration
 */
export function getDemoConfig(): DemoConfig {
  return demoConfig;
}

/**
 * Validate if user can create a new graph in demo mode
 */
export async function canCreateGraph(userId: string, driver: any): Promise<boolean> {
  if (!isDemoMode()) {
    return true;
  }

  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:CREATED]->(g:Graph)
       RETURN count(g) as graphCount`,
      { userId }
    );

    const graphCount = result.records[0]?.get('graphCount')?.toNumber() || 0;
    return graphCount < demoConfig.maxGraphsPerUser;
  } finally {
    await session.close();
  }
}

/**
 * Validate if graph can have more nodes in demo mode
 */
export async function canAddNode(graphId: string, driver: any): Promise<boolean> {
  if (!isDemoMode()) {
    return true;
  }

  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (g:Graph {id: $graphId})<-[:BELONGS_TO]-(w:WorkItem)
       RETURN count(w) as nodeCount`,
      { graphId }
    );

    const nodeCount = result.records[0]?.get('nodeCount')?.toNumber() || 0;
    return nodeCount < demoConfig.maxNodesPerGraph;
  } finally {
    await session.close();
  }
}

/**
 * Get count of currently active users
 */
export async function getActiveUserCount(driver: any): Promise<number> {
  if (!isDemoMode()) {
    return 0;
  }

  const session = driver.session();
  try {
    // Consider users active if they logged in within the session timeout period
    const timeoutMs = demoConfig.sessionTimeoutMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - timeoutMs);

    const result = await session.run(
      `MATCH (u:User)
       WHERE u.lastLogin >= $cutoffTime
       RETURN count(u) as activeCount`,
      { cutoffTime: cutoffTime.toISOString() }
    );

    return result.records[0]?.get('activeCount')?.toNumber() || 0;
  } finally {
    await session.close();
  }
}

/**
 * Check if new user can sign up (not at max capacity)
 */
export async function canSignup(driver: any): Promise<boolean> {
  if (!isDemoMode()) {
    return true;
  }

  if (!demoConfig.allowSignup) {
    return false;
  }

  const activeCount = await getActiveUserCount(driver);
  return activeCount < demoConfig.maxConcurrentUsers;
}

/**
 * Send lead capture to GraphDone-Website API
 */
export async function captureSignupLead(
  email: string,
  name: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!isDemoMode() || !demoConfig.leadCaptureApiUrl) {
    return;
  }

  try {
    const response = await fetch(demoConfig.leadCaptureApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        name,
        source: 'demo',
        timestamp: new Date().toISOString(),
        metadata,
      }),
    });

    if (!response.ok) {
      console.error('Failed to capture lead:', await response.text());
    }
  } catch (error) {
    // Don't fail signup if lead capture fails
    console.error('Error capturing lead:', error);
  }
}
