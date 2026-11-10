# `packages/web/src/contexts/` — app-wide state

React context providers for the state almost every screen needs: who is signed
in, which graph (project) is open, which view is showing, and toast
notifications. [`../App.tsx`](../App.tsx) wraps the app in them; components
read them with the matching `use...` hook (about 40 files use `useAuth` or
`useGraph`).

```mermaid
flowchart TD
  app["App.tsx"] --> auth["AuthProvider (all routes)"]
  auth -->|"signed in"| notif["NotificationProvider"]
  notif --> graphCtx["GraphProvider"]
  graphCtx --> view["ViewModeProvider"]
  view --> layout["Layout + pages"]
  auth -->|"me query, token"| apollo["Apollo / lib/authStorage"]
  graphCtx -->|"graph queries"| apollo
```

## What's here

| Path | What it is |
| --- | --- |
| [`AuthContext.tsx`](AuthContext.tsx) | `AuthProvider` / `useAuth`: restores the saved session from [`../lib/authStorage.ts`](../lib/authStorage.ts), confirms it with the `me` query, and exposes `currentUser`, `currentTeam`, `login`, `logout`, `isAuthenticated`. |
| [`GraphContext.tsx`](GraphContext.tsx) | `GraphProvider` / `useGraph`: the list of graphs the user can see, the current graph (remembered in `localStorage`), create/update/delete/duplicate/move, and sub-graph navigation (`descendInto`, `ascendTo`, breadcrumbs). Uses [`../graphql/graph.ts`](../graphql/graph.ts). |
| [`ViewModeContext.tsx`](ViewModeContext.tsx) | `ViewModeProvider` / `useViewMode`: graph, dashboard, table, cards, kanban, gantt, calendar or activity; saved as `graphdone:viewMode`. |
| [`NotificationContext.tsx`](NotificationContext.tsx) | `NotificationProvider` / `useNotifications`: `showSuccess` / `showError` toasts. |

The types for the auth and graph contexts are in [`../types/`](../types/README.md).

Up: [`src/`](../README.md)
