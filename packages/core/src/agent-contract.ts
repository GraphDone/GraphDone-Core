/** Small, transport-neutral contract shared by hosted and self-hosted agents. */
export function agentDiscovery(hosted: boolean) {
  return {
    version: 1,
    authentication: {type: 'Bearer', projectParameter: 'graphId', accountAccess: false},
    start: [
      {method: 'GET', path: '/limits', purpose: 'Check remaining allowance and allowed actions'},
      {method: 'GET', path: '/context', purpose: 'Read task IDs, priorities, capabilities and shared notes'},
    ],
    operations: [
      {method: 'GET', path: '/discovery', authentication: false},
      {method: 'GET', path: '/limits', authentication: true},
      {method: 'GET', path: '/context', authentication: true},
      {method: 'PATCH', path: '/items', scope: 'collaborate', body: {id: 'returned task ID', status: 'IN_PROGRESS'}},
      {method: 'POST', path: '/notes', scope: 'collaborate', body: {body: 'Useful result, blocker or handoff', workItemId: 'optional returned task ID'}},
      ...(hosted ? [{method: 'POST', path: '/shares', scope: 'collaborate', requiresExplicitSharingPermission: true, body: {}}] : []),
    ],
    constraints: {priority: {min: 0, max: 1, highestFirst: true}, noteCharacters: 4000, createOrDeleteTasks: false, launchModels: false},
    coordination: {humanMustRemainOnline: false, shareOwnerBudget: hosted, tokenRotationResetsBudget: false, acknowledgementLoops: false},
    recovery: {429: 'Stop until Retry-After/resetAt; do not rotate tokens', 401: 'Stop and request valid credentials', 403: 'Stop; additional permission is required', ambiguousWrite: 'Do not blindly repeat'},
    onboarding: {mode: 'human-sign-in-and-token', agentInitiatedEmailSignup: false, instructions: 'The owner signs in, opens Agents, creates a project token, and privately supplies the connection prompt. Email-approved agent enrollment is not enabled yet.'},
  };
}
export function agentLimits(usage: any, scope = 'collaborate') {
  const remaining = (used: Record<string, number>, limit: Record<string, number>) => Object.fromEntries(Object.keys(limit).map(key => [key, Math.max(0, limit[key] - (used[key] || 0))]));
  const agent = usage.agents;
  const available = usage.status === 'AVAILABLE';
  const left = agent ? remaining(agent.used, {requests: agent.limit.requests, updates: agent.limit.updates}) : null;
  const burst = agent?.burst;
  const canRead = available && !!left && left.requests > 0 && (!burst || burst.used < burst.limit);
  const canWrite = scope === 'collaborate' && canRead && left!.updates > 0;
  return {
    version: 1, hosted: true, advisory: true,
    account: {used: usage.used, limit: usage.limit, remaining: remaining(usage.used, usage.limit), status: usage.status, resetAt: usage.resetAt},
    agent: agent ? {...agent, remaining: left} : null,
    sharing: usage.sharing ? {...usage.sharing, remaining: remaining(usage.sharing.used, {links: usage.sharing.limit.links, reads: usage.sharing.limit.reads})} : null,
    actions: {canRead, canWrite, next: canWrite ? 'WORK' : canRead ? (scope === 'read' ? 'READ_ONLY' : 'READ_ONLY_UNTIL_RESET') : 'PAUSE'},
    checks: {countsTowardAgentActivity: false, authenticationMayUseDatabase: true, recommendedMinimumIntervalSeconds: 60},
    constraints: usage.limits,
    note: 'Remaining allowance is not a reservation. Other agents and humans can use it. Shared service and per-IP authentication limits also apply; stop on HTTP 429.',
  };
}
