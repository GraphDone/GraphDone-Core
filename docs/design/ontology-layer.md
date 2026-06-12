# The Ontology Layer — GraphDone as a Graph-Work Backbone

> Status: design v1, 2026-06-11. Research basis: Palantir Foundry Ontology
> (object types, link types, interfaces, actions), Jama/DOORS requirements
> traceability, requirements-traceability ontology literature. Sources and
> the full research digest live in the PR discussion.

## Why

Task management is one ontology. Requirements management is another. Risk
registers, OKRs, lab protocols, incident response — all graphs of typed
objects and typed links. GraphDone's bet: **one living graph engine, many
overlapping ontology sets**, equally usable by humans (visual, joyful) and AI
agents (MCP, Skills) — *human observable, human optional*.

What Palantir proved (and charges millions for): decouple the **semantic
layer** (object types, properties, link types — the nouns) from storage, and
gate every write through a **kinetic layer** (validated actions — the verbs).
What we add that they don't have: the graph IS the UI, it's alive, it's open
source, and agents are first-class citizens.

## The meta-model (as data, not code)

New Neo4j node labels — the ontology layer is itself a graph:

```
(:OntologySet {key, name, description, builtin})
(:ObjectTypeDef {key, name, description, icon, color,
                 properties: [{key, type: string|number|date|enum|userRef,
                               required, enumValues?}],
                 version, builtin})
(:LinkTypeDef  {key, name, inverseName,
                sourceTypeKeys: [...], targetTypeKeys: [...],
                cardinality: ONE_TO_MANY | MANY_TO_MANY,
                semantics: trace | hierarchy | dependency | association,
                builtin})
(:ObjectTypeDef)-[:IN_SET]->(:OntologySet)
(:LinkTypeDef)-[:IN_SET]->(:OntologySet)
(work item / object)-[:INSTANCE_OF]->(:ObjectTypeDef)
```

**Overlap is the point**: an ObjectTypeDef can belong to multiple sets, and
LinkTypeDefs can span sets (`IMPLEMENTS: Task → SystemRequirement` bridges
the task set and the requirements set). A graph activates one or more sets;
its palette (what `+` grows, what link chips offer) comes from the union.

Today's hardcoded WorkItem types (EPIC…RESEARCH) and edge enums (DEPENDS_ON…)
become the **built-in "Task Management" set** — non-deletable, so nothing
existing breaks and zero migration is needed for v1.

## Validated writes ("actions-lite")

Every create/update/link goes through one generic, def-aware path:

- `createObject(typeKey, properties, graphId)` — validates required props,
  enum values, property types against the def; stamps provenance
  (who/what-agent/when).
- `createTypedLink(linkTypeKey, sourceId, targetId)` — validates endpoint
  types and cardinality (rejects a second `VERIFIES` target when 1:many says
  otherwise).
- No un-validated writes, ever — otherwise coverage metrics lie.

Skip (until users ask): configurable action types, parameter forms, webhooks.
Never skip: the validation gate and the audit trail.

## The Requirements Pack (first non-builtin set, ships as seed data)

Object types: **StakeholderNeed** (source, rationale, priority) ·
**SystemRequirement** (text, kind: functional/non-functional, status:
draft/reviewed/approved, criticality) · **Verification** (method:
test/analysis/inspection/demonstration, result: pass/fail/blocked, evidence
URL) · **Risk** (hazard, severity, likelihood, mitigation status).

Trace links (all `semantics: trace`):

| Link | From → To | Meaning |
|------|-----------|---------|
| DERIVES_FROM | SystemRequirement → StakeholderNeed | decomposition |
| SATISFIES | Feature → SystemRequirement | design satisfies req |
| IMPLEMENTS | Task/Bug → SystemRequirement | **the bridge to task mgmt** |
| VERIFIES | Verification → SystemRequirement | proof |
| MITIGATES | Requirement/Task → Risk | risk control |
| REFINES | SystemRequirement → SystemRequirement | detail |

**Coverage is the product** (what Jama/DOORS users actually pay for):
- `coverageReport(graphId)`: % requirements verified (≥1 passing
  Verification), % implemented (tasks done), orphans both directions
  (requirements no one asked for; needs nobody decomposed; tasks tracing to
  nothing).
- **Suspect links**: requirement text changed after a trace link was made →
  link flagged suspect until re-reviewed (`contentChangedAt` vs link
  `reviewedAt`). Cheap to implement, enormous trust value.
- All of it is plain Cypher — Neo4j makes the traceability queries trivial
  where Palantir needs an indexing layer.

In the living graph, the requirements layer renders as a **stratum**: trace
links flow energy upward when verifications pass; an unverified approved
requirement aches like a blocked task. Same organism, new tissue.

## AI-parallel track (human observable, human optional)

The ontology must be agent-operable the day it exists:

- **MCP tools**: `list_ontology_sets`, `get_type_def`, `create_object_typed`,
  `create_trace_link`, `get_coverage_report`, `list_suspect_links`. Same
  validation gate as the UI — agents get machine-readable rejections
  (`{code, hint, retryable}`, story AI-2).
- **Claude Skill** (`graphdone` skill, separate repo dir `skills/`): teaches
  Claude to run a full requirements workflow — ingest a spec document →
  propose StakeholderNeeds/SystemRequirements as a graph → maintain
  trace links as tasks complete → emit coverage reports. Humans watch it
  happen live in the graph (presence + celebration bursts), or don't.
- **get_graph_context** grows an `ontology` section: active sets, type
  counts, coverage headline — one call orients an agent on any domain graph.

## Build order (each step shippable + gated)

1. **Meta-model nodes + seed** — built-in Task set + Requirements Pack as
   data; `INSTANCE_OF` backfill for existing items. No UI change yet.
2. **Validated generic mutations** + MCP tools over them (AI track lands
   simultaneously — that's the parallel-not-sequel commitment).
3. **Palette from ontology**: grow-mode `+` and link chips read the active
   sets' defs instead of hardcoded enums. The Ontology page (today a stub)
   becomes the set browser/editor.
4. **Coverage + suspect queries** as GraphQL fields + a trace-matrix view;
   coverage headline in `get_graph_context`.
5. **Claude Skill + docs** — the requirements workflow end-to-end, agent-run,
   human-watched.

## Decisions locked (from the research)

1. Meta-model as data, one generic instance path — NOT per-type generated
   GraphQL schema (10% of the cost, all of the value).
2. Validation gate from day one; configurable actions deferred.
3. Interfaces deferred; `semantics` tag on link types covers polymorphic
   trace queries for now (composition later, Palantir-style, if needed).
4. Coverage + suspect links before any type-editor polish — they are why
   requirements people switch tools.
5. Schema evolution planned now: `version` on defs, additive changes free,
   two migration primitives (cast property, drop property) as batch jobs.
