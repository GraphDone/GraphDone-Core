# Project JSON and Mermaid

On the hosted/offline-enabled app, open the project selector in graph view. **Export JSON** downloads just the selected project, including unsynced local changes. **Import project** accepts project JSON or existing GraphDone offline backups. Settings → Import backup accepts both too. Imports are atomic local saves with new project, task, connection and note IDs; the original remains untouched. Select the imported copy in the project list. Guest copies remain local; signed-in copies upload when allowance is available.

`graphdone-project`, version `1`, is GraphDone's documented interchange format, not a claim of compatibility with every graph application. It uses standard JSON and JSON Schema 2020-12. The public schema is `/schemas/project-v1.schema.json`; [example](project-v1.example.json). Arrays are `nodes`, `edges`, and `notes`; project properties are under `project`. Task tags are a JSON array; `metadata` remains a string to preserve existing custom payloads exactly. Priority is 0–1. Positions are canvas coordinates. IDs must be unique per array and connection/note task references must exist. Status/type names are preserved. JSON Schema describes shape; the importer also validates references and uniqueness.

## Portable AI-authored system metadata

Semantic hierarchy paths are labels, never node IDs. Put them in the existing metadata JSON string as `metadata.lod.groupPath`, preferably as an array so `/` inside a multilingual segment remains text:

```json
{"lod":{"groupPath":["Sistema de pagos / 支払システム","API de cobros / 決済 API"]},"graphdone":{"portable":{"version":1,"nodeRefs":{"sourceItem":"source-node-id"}}},"vendor":{"kept":"unchanged"}}
```

An item whose path is `[]` is ungrouped; `["Sistema de pagos / 支払システム"]` is a direct system member; adding the service segment makes it a direct service member; a third segment can represent a component. Disconnected items, directed cycles and multiple differently typed connections between the same ordered pair remain ordinary nodes and edges. Titles and path segments may be long or multilingual within the normal field limits.

Version-1 project documents and opaque metadata strings remain valid. Import never scans arbitrary strings for IDs: unknown metadata is copied exactly. The only embedded node references GraphDone interprets are declared string values under `metadata.graphdone.portable` with `version: 1` and a `nodeRefs` object. Each value must name a node in that same exported project. A fresh-ID import remaps those declared values through the same map as edges and notes. Unsupported versions, malformed declarations, or missing targets reject the whole import with a recoverable explanation before storage changes. This reserved metadata contract can be extended independently of the outer version-1 project document.

Export contains no account owner IDs, agent credentials, authentication, permission grants, or sync receipts. Descriptions and notes are included: review them before sharing. Displayed note author labels are preserved locally, but cloud sync records imported notes under the importing human's authority. Notes whose original task was deleted are exported as project notes, preserving their text. Project IDs are informational: importing always makes copies. Account settings, tokens and sharing permissions do not transfer. Pending sync conflicts should be resolved before transferring: individual JSON exports the current local version; full offline backup retains both versions.

Limits: 50 MB per file, 100 projects total after import, 300 tasks / 600 connections / 2,000 notes per project. A portable reference object has at most 50 named references; names are at most 100 characters and the final metadata string remains within 10,000 characters. Invalid files and unsupported versions fail without partial imports. Unrecognized fields do not receive authority and are omitted by the project importer. Offline backups remain compatible.

**Export Mermaid** downloads `.mmd` source using [Mermaid flowchart syntax](https://mermaid.js.org/syntax/flowchart.html). It includes task titles, statuses and directed connection types; labels are escaped as entities and IDs are generated independently of user text. Disconnected tasks and cyclic connections are supported. The renderer chooses layout. Descriptions, notes, priorities, dates and exact canvas positions are available in JSON, not this diagram. Mermaid import is not supported: Mermaid is a presentation export, not a lossless backup.

## Repeatable validation

- `npm run test -w @graphdone/web -- src/lib/project-transfer src/lib/offline/model.test.ts`
- Build offline-enabled web against a local API, then run headed, serial: `DISPLAY=:1 PLAYWRIGHT_BROWSERS_PATH=/tmp/graphdone-playwright TEST_URL=http://localhost:3136 npx playwright test tests/e2e/quality/project-transfer.spec.ts --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --reporter=line`
- The guest transfer suite makes no cloud writes. It imports a bounded system/service/component fixture through the file picker, including long multilingual paths, direct and disconnected members, a typed cycle and a differently typed parallel connection. It exports and reimports that fixture, checks fresh IDs plus declared-reference remapping and unrelated metadata preservation, verifies invalid-reference atomicity, reloads the rendered graph, and parses/renders Mermaid with the real dev-only Mermaid package. Responsive controls are checked at phone portrait/landscape, tablet and desktop sizes.
