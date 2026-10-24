// MCP-1 (#28): pure synthesis logic behind the suggest_task_assignment tool.
// Given contributor expertise + availability and a set of open tasks, rank the
// best contributor for each task. Kept free of Neo4j/IO so it can be unit-tested
// deterministically; the GraphService gathers the inputs and calls this.

export type ExpertiseLevel = 'Expert' | 'Proficient' | 'Beginner';

export type CapacityStatus = 'available' | 'busy' | 'at_capacity' | 'overloaded';

export interface ContributorExpertise {
  workType: string;
  level: ExpertiseLevel;
  completionRate?: number;
}

export interface ContributorProfile {
  id: string;
  name: string;
  activeItems: number;
  capacityStatus?: CapacityStatus;
  expertise: ContributorExpertise[];
}

export interface OpenTask {
  id: string;
  title: string;
  type: string;
  priority?: number;
}

export interface AssignmentWeights {
  expertiseWeight: number;
  availabilityWeight: number;
}

export interface RankTaskAssignmentsOptions {
  weights?: Partial<AssignmentWeights>;
  maxCandidatesPerTask?: number;
  capacityCeiling?: number;
}

export interface CandidateScore {
  contributorId: string;
  contributorName: string;
  score: number;
  expertiseScore: number;
  availabilityScore: number;
  matchedLevel: ExpertiseLevel | null;
  rationale: string;
}

export interface AssignmentSuggestion {
  taskId: string;
  taskTitle: string;
  taskType: string;
  bestCandidate: CandidateScore | null;
  candidates: CandidateScore[];
}

export const DEFAULT_WEIGHTS: AssignmentWeights = {
  expertiseWeight: 0.6,
  availabilityWeight: 0.4
};

export const DEFAULT_CAPACITY_CEILING = 15;
export const DEFAULT_MAX_CANDIDATES = 3;

const LEVEL_BASE: Record<ExpertiseLevel, number> = {
  Expert: 1,
  Proficient: 0.6,
  Beginner: 0.3
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeWeights(weights?: Partial<AssignmentWeights>): AssignmentWeights {
  const expertiseWeight = weights?.expertiseWeight ?? DEFAULT_WEIGHTS.expertiseWeight;
  const availabilityWeight = weights?.availabilityWeight ?? DEFAULT_WEIGHTS.availabilityWeight;
  const sum = expertiseWeight + availabilityWeight;
  if (sum <= 0) {
    return { expertiseWeight: 0.5, availabilityWeight: 0.5 };
  }
  return {
    expertiseWeight: expertiseWeight / sum,
    availabilityWeight: availabilityWeight / sum
  };
}

function expertiseScoreFor(
  task: OpenTask,
  contributor: ContributorProfile
): { score: number; matched: ContributorExpertise | null } {
  const matched = contributor.expertise.find(e => e.workType === task.type) ?? null;
  if (!matched) {
    return { score: 0, matched: null };
  }
  const base = LEVEL_BASE[matched.level];
  const completion = matched.completionRate;
  const completionFactor =
    typeof completion === 'number' ? 0.85 + 0.15 * clamp01(completion) : 1;
  return { score: clamp01(base * completionFactor), matched };
}

function availabilityScoreFor(
  contributor: ContributorProfile,
  capacityCeiling: number
): number {
  if (contributor.capacityStatus === 'overloaded') {
    return 0;
  }
  const ceiling = capacityCeiling > 0 ? capacityCeiling : DEFAULT_CAPACITY_CEILING;
  return clamp01(1 - contributor.activeItems / ceiling);
}

function buildRationale(
  contributor: ContributorProfile,
  matched: ContributorExpertise | null,
  task: OpenTask
): string {
  const expertisePart = matched
    ? `${matched.level} in ${task.type}`
    : `no direct ${task.type} expertise`;
  const loadPart =
    contributor.capacityStatus === 'overloaded'
      ? 'currently overloaded'
      : `${contributor.activeItems} active item(s)`;
  return `${contributor.name}: ${expertisePart}, ${loadPart}.`;
}

function compareCandidates(a: CandidateScore, b: CandidateScore): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.expertiseScore !== a.expertiseScore) return b.expertiseScore - a.expertiseScore;
  if (b.availabilityScore !== a.availabilityScore) {
    return b.availabilityScore - a.availabilityScore;
  }
  return a.contributorId.localeCompare(b.contributorId);
}

export function rankTaskAssignments(
  tasks: OpenTask[],
  contributors: ContributorProfile[],
  options: RankTaskAssignmentsOptions = {}
): AssignmentSuggestion[] {
  const weights = normalizeWeights(options.weights);
  const capacityCeiling = options.capacityCeiling ?? DEFAULT_CAPACITY_CEILING;
  const maxCandidates = Math.max(1, options.maxCandidatesPerTask ?? DEFAULT_MAX_CANDIDATES);

  return tasks.map(task => {
    const candidates = contributors
      .map<CandidateScore>(contributor => {
        const { score: expertiseScore, matched } = expertiseScoreFor(task, contributor);
        const availabilityScore = availabilityScoreFor(contributor, capacityCeiling);
        const score = clamp01(
          weights.expertiseWeight * expertiseScore +
            weights.availabilityWeight * availabilityScore
        );
        return {
          contributorId: contributor.id,
          contributorName: contributor.name,
          score: Number(score.toFixed(4)),
          expertiseScore: Number(expertiseScore.toFixed(4)),
          availabilityScore: Number(availabilityScore.toFixed(4)),
          matchedLevel: matched ? matched.level : null,
          rationale: buildRationale(contributor, matched, task)
        };
      })
      .sort(compareCandidates)
      .slice(0, maxCandidates);

    return {
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.type,
      bestCandidate: candidates[0] ?? null,
      candidates
    };
  });
}
