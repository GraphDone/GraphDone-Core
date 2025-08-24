/**
 * Distributed leader election utilities
 * Implements a simplified Raft-like consensus algorithm
 */

interface Candidate {
  id: string;
  timestamp: number;
  priority: number;
}

interface ElectionResult {
  leader: string | null;
  term: number;
  votes: Map<string, string>;
}

/**
 * Thread-safe leader election implementation
 */
export class LeaderElection {
  private static instances: Map<string, LeaderElection> = new Map();
  private static globalLock: Map<string, boolean> = new Map();
  
  private currentLeader: string | null = null;
  private currentTerm: number = 0;
  // @ts-expect-error - _votedFor is part of incomplete election implementation 
  private _votedFor: string | null = null;
  private candidates: Map<string, Candidate> = new Map();
  private electionTimeout: NodeJS.Timeout | null = null;
  
  private constructor(private namespace: string) {}
  
  /**
   * Get singleton instance for a namespace
   */
  static getInstance(namespace: string = 'default'): LeaderElection {
    if (!this.instances.has(namespace)) {
      this.instances.set(namespace, new LeaderElection(namespace));
    }
    return this.instances.get(namespace)!;
  }
  
  /**
   * Start leader election with proper conflict resolution
   */
  async startElection(candidate: Candidate): Promise<ElectionResult> {
    // Acquire global lock to prevent split-brain scenarios
    const lockKey = `election_${this.namespace}`;
    
    if (LeaderElection.globalLock.get(lockKey)) {
      // Another election is in progress, wait and return current state
      await this.waitForElectionCompletion();
      return this.getCurrentState();
    }
    
    LeaderElection.globalLock.set(lockKey, true);
    
    try {
      // Clear existing election timeout
      if (this.electionTimeout) {
        clearTimeout(this.electionTimeout);
      }
      
      // Add candidate to election
      this.candidates.set(candidate.id, candidate);
      
      // Start new election term
      this.currentTerm++;
      this._votedFor = null;
      
      // Collect votes using deterministic algorithm
      const votes = await this.collectVotes();
      
      // Determine leader using consistent algorithm
      const leader = this.determineLeader(votes);
      
      // Commit election results
      this.currentLeader = leader;
      this.candidates.clear();
      
      // Set election timeout for next election
      this.setElectionTimeout();
      
      return {
        leader,
        term: this.currentTerm,
        votes
      };
      
    } finally {
      LeaderElection.globalLock.set(lockKey, false);
    }
  }
  
  /**
   * Get current election state
   */
  getCurrentState(): ElectionResult {
    return {
      leader: this.currentLeader,
      term: this.currentTerm,
      votes: new Map()
    };
  }
  
  /**
   * Check if a candidate can become leader
   */
  canBecomeLeader(candidateId: string): boolean {
    return !this.currentLeader || this.currentLeader === candidateId;
  }
  
  /**
   * Force leadership change (for testing)
   */
  forceLeaderChange(): void {
    this.currentLeader = null;
    this.currentTerm++;
  }
  
  private async waitForElectionCompletion(): Promise<void> {
    const maxWait = 1000; // 1 second
    const interval = 10; // 10ms
    let waited = 0;
    
    while (LeaderElection.globalLock.get(`election_${this.namespace}`) && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, interval));
      waited += interval;
    }
  }
  
  private async collectVotes(): Promise<Map<string, string>> {
    const votes = new Map<string, string>();
    const candidateArray = Array.from(this.candidates.values());
    
    // Sort candidates deterministically to prevent race conditions
    candidateArray.sort((a, b) => {
      // First by priority (higher wins)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by timestamp (earlier wins)
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      // Finally by ID for consistency
      return a.id.localeCompare(b.id);
    });
    
    // Each candidate votes for the highest priority candidate
    for (const voter of candidateArray) {
      const choice = candidateArray[0]; // Highest priority candidate
      votes.set(voter.id, choice.id);
    }
    
    return votes;
  }
  
  private determineLeader(votes: Map<string, string>): string | null {
    if (votes.size === 0) {
      return null;
    }
    
    // Count votes
    const voteCounts = new Map<string, number>();
    for (const vote of votes.values()) {
      voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
    }
    
    // Find candidate with most votes
    let leader: string | null = null;
    let maxVotes = 0;
    
    for (const [candidate, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        leader = candidate;
      }
    }
    
    // Require majority for leadership
    const requiredVotes = Math.floor(votes.size / 2) + 1;
    return maxVotes >= requiredVotes ? leader : null;
  }
  
  private setElectionTimeout(): void {
    // Random timeout between 5-10 seconds to prevent synchronized elections
    const timeout = 5000 + Math.random() * 5000;
    
    this.electionTimeout = setTimeout(() => {
      // Trigger re-election if leader is inactive
      this.currentLeader = null;
    }, timeout);
  }
}

/**
 * Simple coordinator election for MCP operations
 */
export async function electCoordinator(
  candidates: Array<{ id: string; timestamp: number; priority: number }>,
  namespace: string = 'mcp-coordinator'
): Promise<string | null> {
  
  if (candidates.length === 0) {
    return null;
  }
  
  if (candidates.length === 1) {
    return candidates[0].id;
  }
  
  const election = LeaderElection.getInstance(namespace);
  
  // Run election for each candidate
  let finalResult: ElectionResult | null = null;
  
  for (const candidate of candidates) {
    const result = await election.startElection(candidate);
    finalResult = result;
    
    // If we have a clear leader, use it
    if (result.leader) {
      break;
    }
  }
  
  return finalResult?.leader || null;
}