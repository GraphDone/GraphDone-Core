# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GraphDone is a graph-native project management system that reimagines work coordination through dependencies and democratic prioritization rather than hierarchical assignments. The project is in active development (v0.2.2-alpha) with a fully working foundation across web application, GraphQL API, and graph database.

## Core Philosophy

- Work flows through natural dependencies, not artificial hierarchies
- Ideas migrate from periphery to center based on community validation and democratic prioritization
- Human and AI agents collaborate as peers through the same graph interface
- Designed for neurodivergent individuals and those who think differently about work

## Technology Stack

**Core Stack:**
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + D3.js
- **Backend**: Node.js + TypeScript + Apollo Server + GraphQL
- **Database**: Neo4j 5.15-community with @neo4j/graphql auto-generated resolvers
- **Build System**: Turbo monorepo with npm workspaces
- **Testing**: Playwright (E2E) + Vitest (unit tests)
- **Infrastructure**: Docker + Docker Compose

**Key Libraries:**
- `@neo4j/graphql` - Auto-generates GraphQL schema and resolvers from Neo4j
- `@apollo/client` - GraphQL client with caching and real-time subscriptions
- `lucide-react` - Consistent icon system throughout UI
- `d3` - Graph visualization and force simulation

## Essential Commands

### Quick Start
```bash
# Production HTTPS deployment (standard)
./start deploy

# Development environment (HTTP only)
./start                # Full setup + development start
./start quick          # Quick start without full setup checks
./start dev            # Development with npm servers
```

### Development Workflow
```bash
# Start all development servers (web on :3127, API on :4127)
npm run dev

# Run tests
npm run test              # All tests including E2E
npm run test:unit         # Unit tests only  
npm run test:e2e          # E2E tests only
npm run test:coverage     # With coverage report

# Code quality
npm run lint              # ESLint all packages
npm run typecheck         # TypeScript check all packages
npm run build             # Build all packages for production
```

### Database Operations
```bash
# Seed Neo4j with sample data (32 work items + relationships)
npm run db:seed

# Access Neo4j Browser
# http://localhost:7474 (neo4j/graphdone_password)
```

### Package-Specific Development
```bash
# Core graph engine
cd packages/core && npm run dev

# GraphQL API server  
cd packages/server && npm run dev

# React web application
cd packages/web && npm run dev

# MCP server for Claude Code integration
cd packages/mcp-server && npm run dev
```

## Architecture Overview

### Monorepo Structure
```
packages/
├── core/           # Graph algorithms and data structures
├── server/         # GraphQL API with Neo4j integration
├── web/            # React frontend with D3.js visualization
└── mcp-server/     # Claude Code integration server
```

### Core Graph Engine (`packages/core/`)

The heart of GraphDone is a custom graph implementation:

**Key Classes:**
- `Graph` - Main container with adjacency lists, pathfinding, cycle detection
- `Node` - Individual graph nodes with spherical positioning based on priority  
- `Edge` - Typed connections (DEPENDS_ON, BLOCKS, ENABLES, etc.)
- `Priority` - Multi-dimensional priority system (executive, individual, community)

**Core Types:**
- `NodeType` - OUTCOME, TASK, MILESTONE, IDEA
- `NodeStatus` - PROPOSED, ACTIVE, IN_PROGRESS, BLOCKED, COMPLETED, ARCHIVED
- `EdgeType` - 11 relationship types for complex dependency modeling
- `SphericalCoordinate` - 3D positioning where radius = inverse priority

### GraphQL API (`packages/server/`)

**Architecture:**
- Auto-generated schema using `@neo4j/graphql` from database constraints
- Real-time subscriptions for live updates
- Direct Neo4j authentication (no Prisma/PostgreSQL dependencies)
- Authentication with Passport.js (Google OAuth, GitHub OAuth, LinkedIn OAuth + local)
- Health check endpoint at `/health`

**Key Files:**
- `src/schema/neo4j-schema.ts` - Core GraphQL type definitions
- `src/schema/auth-schema.ts` - Authentication GraphQL schema extensions
- `src/resolvers/auth.ts` - Authentication resolvers and OAuth handlers
- `src/index.ts` - Apollo Server setup with WebSocket support
- `src/scripts/seed.ts` - Database seeding with realistic test data

### Web Application (`packages/web/`)

**Component Architecture:**
- `InteractiveGraphVisualization` - Enhanced D3.js force-directed graph with advanced interactions
- `SafeGraphVisualization` - Error-boundary wrapped graph visualization
- `ViewManager` - Orchestrates dashboard, table, kanban, gantt, calendar, and card views
- `Workspace` - Main layout with graph selector, view modes, and data issues tracking
- `useDialogManager` - Centralized hook for managing all dialogs/overlays lifecycle
- Multiple modal components for CRUD operations (Create, Edit, Delete, Connect, etc.)

**Key Features:**
- Graph selector with hierarchical tree navigation (Team/Personal/Templates)
- Real-time updates via Apollo Client subscriptions
- Multiple visualization modes (graph, dashboard, table, kanban, gantt, calendar, card)
- Responsive design with tropical lagoon animated background
- Dialog manager for efficient click-outside-to-close behavior
- Right sidebar with contextual information and actions
- Activity feed for real-time collaboration awareness

**Constants and Styling:**
- `workItemConstants.tsx` - Centralized icon mappings, color schemes, and gradients
- Priority-based coloring system with animated elements
- Consistent Tailwind classes with transparency and backdrop blur
- Modern card-based layouts with dynamic theming

### Database Schema (Neo4j)

**Core Node Types:**
- `WorkItem` - Primary nodes with title, description, type, status, priority
- `Graph` - Container nodes for organizing work items  
- `Team` - Organizational structure
- `User` - Authentication and ownership

**Relationships:**
- `DEPENDS_ON` - Core dependency relationships
- `ASSIGNED_TO` - Work assignment
- `BELONGS_TO` - Graph membership
- Plus 8 other relationship types for complex modeling

## Key Implementation Patterns

### Graph-First Design
All features work within the graph paradigm. Every action creates or modifies nodes and edges rather than traditional hierarchical structures.

### Democratic Prioritization
Priority is multi-dimensional:
- Individual priority (personal importance)
- Community priority (democratic validation)
- Executive priority (strategic flags)
- Computed priority (algorithmic combination)

### Agent Integration
AI agents are first-class citizens accessing the same GraphQL endpoints as humans. The MCP server provides natural language interface for Claude Code.

### Real-Time Collaboration
WebSocket subscriptions ensure all users see live updates to the graph structure and work item status.

### Mobile-First UI
Touch interactions are primary, with hover states as enhancements. All components work on mobile screens.

### Dialog Management System
**CRITICAL DESIGN PATTERN**: All dialogs, overlays, dropdowns, and temporary UI elements use a centralized dialog manager for consistent behavior.

**Dialog Manager Philosophy:**
- Dialogs should close when users click outside them (on empty graph space)
- Users shouldn't have to hunt for X buttons - click-outside-to-close is more efficient
- Centralized management ensures proper cleanup and prevents memory leaks
- All temporary UI elements register/unregister with the global manager

**Implementation via `useDialogManager` Hook:**
```jsx
import { useDialog, useDialogManager } from '@/hooks/useDialogManager';

// Component using a dialog
const MyComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Register this dialog with the manager
  useDialog(isOpen, () => setIsOpen(false));
  
  return (
    <>
      {isOpen && (
        <div className="dialog">
          {/* Dialog content */}
        </div>
      )}
    </>
  );
};

// Component that needs to close all dialogs
const GraphView = () => {
  const { closeAllDialogs } = useDialogManager();
  
  const handleBackgroundClick = () => {
    closeAllDialogs(); // Closes all registered dialogs
  };
};
```

**Current Dialog Implementations:**
- Graph selector dropdown in `Workspace.tsx`
- Data Issues panel in `Workspace.tsx`
- All modal dialogs (Create, Edit, Delete, Connect, etc.)
- Right sidebar panels and overlays
- Filter/search dropdowns in views

**Dialog Requirements:**
- Register all temporary UI with `useDialog` hook
- Implement click-outside-to-close behavior
- Clean up properly on unmount
- Use React portals for z-index issues when needed

## Testing Strategy

**Unit Tests (Vitest):**
- Graph algorithms and priority calculations
- Component logic and utility functions
- GraphQL resolver behavior

**E2E Tests (Playwright):**
- Full user workflows across graph visualization
- Error handling and recovery scenarios
- Multi-browser compatibility
- Screenshot comparisons for visual regression

**Test Commands:**
```bash
# Run specific test suites
npm run test:e2e:core          # Core functionality
npm run test:e2e:error-handling # Error scenarios
playwright test --ui           # Interactive test runner
```

## Current Development Focus

### UI/UX Design Language Standardization
The project is actively establishing a cohesive design language across all views:

**Layout Standards:**
- **Left Sidebar**: Consistent navigation with collapsible sections
- **Top Bar**: Graph selector (left) + view mode buttons (center) + actions (right)
- **Transparent Backgrounds**: Semi-transparent panels with backdrop blur for "zen mode"
- **Tropical Lagoon Animation**: Consistent animated background across all views

**Visual Consistency:**
- Standardized spacing, typography, and color schemes
- Consistent hover states and interaction patterns
- Unified modal and dropdown styling
- Priority-based coloring system with animated elements

### Graph vs View Conceptual Clarification

**Graphs are Dynamic Filters, Not Static Views:**
A "graph" in GraphDone represents a specific filtered view of your data, not just the visualization mode. Examples:

- **Project Graph**: Filters to show only nodes related to "Mobile App Redesign"
- **Team Graph**: Shows all work items assigned to or owned by the Design Team
- **Epic Graph**: Filters to show tasks, outcomes, and milestones under a specific epic
- **Custom User Graph**: Personal filtered view like "My High Priority Tasks"
- **Custom Team Graph**: Shared filtered view like "This Sprint's Deliverables"

**Graph Organization:**
- Organized in hierarchical folders (Team/Personal/Templates)
- Navigable via the prominent dropdown selector in the top bar
- Each graph can be viewed in multiple visualization modes (graph, table, kanban, etc.)
- The same underlying filtered dataset appears consistently across all view modes

### Inline Editing Priority

**Current UX Problem**: Users must open full edit dialogs to modify node properties
**Target UX**: Click-to-edit any property directly from any view

**Implementation Needs:**
- **Table View**: Click on type, status, contributor, priority, due date cells to edit inline
- **Graph View**: Click on node badges/indicators to edit properties without opening modal
- **Kanban View**: Drag-and-drop status changes, click-to-edit other properties on cards
- **Dashboard View**: Click on metrics/stats to filter or edit related items

**Technical Requirements:**
- Consistent inline editing components across all views
- Real-time updates via GraphQL subscriptions
- Optimistic UI updates with rollback on failure
- Keyboard navigation support for accessibility

## Development Philosophy

From the codebase philosophy: "You are building tools that help everyone. Take it seriously, take pride in your work, don't fake tests, we are building open source software which will help people connect with each other and work together."

The future is decentralized, free, and compassionate. This guides all architectural decisions toward democratic coordination rather than hierarchical control.

## Current UI Evolution: Slick Dialog Revolution

GraphDone is undergoing a **major UI transformation** moving away from heavy modal dialogs toward slick, contextual, inline-style editors. This shift prioritizes **immediate feedback, minimal context switching, and delightful micro-interactions**.

### The New Dialog Paradigm: Select Relationship Type

**🎯 Target Design Pattern**: The **Select Relationship Type dialog** (`InteractiveGraphVisualization.tsx:3520-3681`) represents the new gold standard for GraphDone dialogs:

**Key Characteristics:**
- **Contextual positioning**: Appears directly next to the element being edited
- **Immediate visual feedback**: Real-time updates with smooth animations
- **Minimal chrome**: No heavy borders, headers, or separate modals
- **Rich micro-interactions**: Hover effects, scaling, gradient overlays
- **Elegant selection states**: Current selection clearly indicated with animated pulse
- **Sophisticated styling**: Gradient backgrounds, backdrop blur, modern rounded corners
- **Professional animations**: Staggered reveal (30ms delays), scale transforms, smooth transitions

```jsx
// NEW PATTERN: Slick contextual editor
{editingEdge && createPortal(
  <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999999]">
    <div className="absolute bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10"
         style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      <div className="p-5">
        {RELATIONSHIP_OPTIONS.map((option, index) => (
          <button className="w-full flex items-center px-4 py-3 rounded-xl 
                           bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-blue-500/5
                           hover:scale-105 transition-all duration-200"
                  style={{ animationDelay: `${index * 30}ms` }}>
            {/* Rich content with icons, descriptions, selection indicators */}
          </button>
        ))}
      </div>
    </div>
  </div>,
  document.body
)}
```

### The Old Pattern Being Replaced: Heavy Modal Dialogs

**❌ Legacy Pattern**: Traditional modals like `EditNodeModal.tsx` with:
- Full-screen overlays requiring dedicated focus
- Heavy form structures with multiple sections
- Save/Cancel button patterns
- Context switching away from the graph
- Verbose layouts with lots of whitespace

### Planned Dialog Transformations

**🚀 Migration Strategy**: Replace heavy dialogs with contextual, inline-style editors:

1. **Node Editing** → Context menu with expandable sections
2. **Status Changes** → Dropdown selector with immediate effect
3. **Type Selection** → Icon grid with hover previews  
4. **Priority Adjustment** → Inline slider with real-time visual feedback
5. **Connection Management** → Drag-and-drop with contextual relationship picker

## Visual Language Consistency: The Calm Environment System

GraphDone implements a **cohesive visual language** designed to create a calm, unified environment rather than aggressive full-screen takeovers. All pages follow consistent patterns to maintain visual harmony with the tropical lagoon background.

### The Three-Section Top Bar Pattern

**🎯 Standard Layout** (`Workspace.tsx:202-644`): Every page should implement this top bar structure:

```jsx
<div className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700/20">
  <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <div className="hidden lg:block relative w-full h-16 flex items-center">
      {/* LEFT SECTION: Primary Action/Selector */}
      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1/3">
        {/* Graph selector, search, primary navigation */}
      </div>

      {/* CENTER SECTION: Mode/View Buttons */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="flex bg-gray-700/30 backdrop-blur-sm rounded-lg p-2 gap-1">
          {/* Clear icon buttons for different views/modes */}
        </div>
      </div>

      {/* RIGHT SECTION: Status/Actions */}
      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1/3 flex justify-end">
        {/* Connection status, data health, secondary actions */}
      </div>
    </div>
  </div>
</div>
```

**Visual Characteristics:**
- **Semi-transparent background**: `bg-gray-800/30 backdrop-blur-sm` allows lagoon animation to show through
- **Clear sectioning**: Left (primary), Center (modes), Right (status/actions)
- **Consistent height**: `h-16` for all top bars
- **Subtle borders**: `border-b border-gray-700/20` for gentle separation

### The Transparent Sidebar Pattern

**🌊 Zen Mode Sidebar** (`Layout.tsx:74-155`): Left sidebar with generous transparency:

```jsx
<div className="bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50">
  <div className="flex flex-col h-full">
    {/* Logo section with consistent branding */}
    <div className="flex items-center h-16 px-6 border-b border-gray-700">
      <img src="/favicon.svg" alt="GraphDone Logo" className="h-8 w-8" />
      <Link className="ml-3 text-xl font-bold text-green-300">GraphDone</Link>
    </div>

    {/* Navigation with modern tab styling */}
    <nav className="flex-1 px-4 py-6 space-y-2">
      {navigation.map((item) => (
        <Link className={`group flex items-center px-3 py-2 rounded-lg transition-all ${
          isActive 
            ? 'bg-green-600/20 text-green-300 border-l-4 border-l-green-400' 
            : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
        }`}>
          <Icon className="h-5 w-5" />
          <span className="ml-3 font-medium">{item.name}</span>
        </Link>
      ))}
    </nav>
  </div>
</div>
```

**Design Principles:**
- **High transparency**: `bg-gray-800/95` allows subtle animation visibility
- **Backdrop blur**: Creates depth while maintaining readability
- **Active state styling**: Green accent with left border for current page
- **Consistent spacing**: `space-y-2` for navigation items, `px-4 py-6` for container

### Universal Background Animation

**🏝️ Tropical Lagoon System** (`Layout.tsx:31-53` & `index.css:6-175`):

Every page includes the same calming background animation:
```jsx
<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
  <div className="lagoon-caustics">
    <div className="caustic-layer caustic-layer-1"></div>
    <div className="caustic-layer caustic-layer-2"></div>
    {/* ... 10 caustic layers + 10 shimmer layers */}
  </div>
  {/* Page content with transparency to show animation */}
</div>
```

**Animation Characteristics:**
- **10 caustic layers**: Overlapping organic motion patterns
- **10 shimmer layers**: Subtle light scattering effects
- **Parameterized timing**: 40+ CSS custom properties for easy theming
- **Performance optimized**: Uses `transform` and `opacity` only

### Visual Consistency Requirements

**🎨 All Pages Must Follow**: This visual language creates a cohesive environment where users feel they're in one calm application rather than jumping between different interfaces.

**Implementation Checklist for New Pages:**
- ✅ **Transparent top bar**: `bg-gray-800/30 backdrop-blur-sm` 
- ✅ **Three-section layout**: Left (primary), Center (modes), Right (status)
- ✅ **Consistent height**: `h-16` top bar
- ✅ **Universal background**: Include lagoon caustic animation layers
- ✅ **Transparent sidebar**: `bg-gray-800/95 backdrop-blur-sm` if applicable
- ✅ **Green accent system**: Active states use `green-600/20` backgrounds
- ✅ **Backdrop blur everywhere**: Maintain depth while showing animation
- ✅ **Subtle borders**: Use `border-gray-700/20` for gentle separation

**Current Implementation Status:**
- ✅ **Workspace**: Full three-section pattern with center view modes
- ✅ **Layout**: Universal sidebar with transparent design
- ❌ **Ontology**: Needs top bar transparency and center mode buttons
- ❌ **AI & Agents**: Needs visual language consistency
- ❌ **Analytics**: Needs top bar three-section pattern
- ❌ **Settings**: Needs transparent styling integration  
- ❌ **Admin**: Needs visual consistency with workspace pattern
- ❌ **Backend Status**: Needs top bar with right-aligned status indicators

**Anti-Patterns to Avoid:**
- ❌ **Solid backgrounds**: Blocks the calming lagoon animation
- ❌ **Heavy modal takeovers**: Breaks the zen-like environment
- ❌ **Inconsistent heights**: Creates jarring visual jumps
- ❌ **Missing backdrop blur**: Reduces depth and visual hierarchy
- ❌ **Different accent colors**: Breaks the green-focused brand consistency

## Theme Pack Plugin Architecture

GraphDone implements a **sophisticated theme system** designed for extensibility via plugin architecture:

### Current Theme Structure

**🎨 Centralized Theme System** (`workItemConstants.tsx:934-1049`):
- **Multi-context gradients**: Different styles for table, card, kanban, dashboard views
- **Static Tailwind classes**: Ensures proper compilation and performance
- **Centralized color mapping**: Hex colors mapped to Tailwind utility classes
- **View-specific styling**: Each view type gets optimized gradient patterns

```typescript
export type GradientStyle = 'table' | 'card' | 'kanban' | 'dashboard';

export const getTypeGradientBackground = (type: WorkItemType, style: GradientStyle): string => {
  const gradientMap: Record<string, string> = {
    'green-500': 'bg-gradient-to-r from-green-500/15 via-green-500/5 to-green-500/15',
    'blue-500': 'bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-blue-500/15',
    // ... full color palette
  };
  return gradientMap[tailwindColor] || fallback;
};
```

### Tropical Lagoon Animation System

**🌊 CSS Custom Properties** (`index.css:6-43`):
- **Parameterized animations**: Easy to modify via CSS variables
- **Layer-based caustics**: Multiple overlapping animation layers
- **Configurable timing**: Independent duration, amplitude, opacity controls
- **Theme-agnostic structure**: Animation parameters separate from color schemes

```css
:root {
  --lagoon-1-duration: 45s;
  --lagoon-1-x-amplitude: 20%;
  --lagoon-shimmer-opacity-max: 0.24;
  /* ... 40+ customizable parameters */
}
```

### Plugin Architecture Readiness

**🔌 Theme Pack Extensions** (planned):
```typescript
interface ThemePackManifest {
  name: string;
  version: string;
  gradients: GradientStyleMap;
  animations: AnimationConfigMap;
  customProperties: CSSCustomPropertyMap;
  components?: ComponentOverrideMap;
}

// Load theme pack dynamically
const loadThemePack = async (themePack: ThemePackManifest) => {
  // Inject CSS custom properties
  // Override gradient mappings
  // Apply component style overrides
};
```

## Next Priority Tasks

### 1. Graph View Architecture Refactoring (URGENT - 4,015 lines)
- [ ] **Phase 1: Extract Core GraphEngine** - Pure D3 visualization without UI state
- [ ] **Phase 2: Extract MiniMapPlugin** - Swappable themes/backgrounds as plugin
- [ ] **Phase 3: Extract NodeEditorPlugin** - Contextual editing as composition
- [ ] **Phase 4: Extract RelationshipSelectorPlugin** - Slick selector as plugin
- [ ] **Phase 5: Create Plugin System** - Renderer with priority/z-index management
- [ ] **Phase 6: Theme Integration** - Plugin-aware theme switching

### 2. Complete Node Editing Simplification (Critical Path)
- [ ] **Replace EditNodeModal with contextual editor** using Select Relationship Type pattern
- [ ] Implement inline property editing (status, type, priority) in graph view
- [ ] Add drag-to-reposition for contextual dialogs
- [ ] Test click-outside-to-close behavior with dialog manager integration

### 3. Slick Dialog Migration Strategy
- [ ] **Create reusable SlickSelector component** based on Select Relationship Type pattern
- [ ] **Port node context menu** from EditNodeModal to contextual overlay
- [ ] **Implement inline status changer** with immediate visual feedback
- [ ] **Add priority slider widget** with real-time node repositioning
- [ ] **Create type selector grid** with icon hover previews and instant updates

### 4. Clean Architecture Guidelines

**🏗️ Anti-Pattern: Monolithic Components**
- ❌ Components over 500 lines require architectural review
- ❌ More than 10 useState hooks in a single component
- ❌ Mixing UI state with business logic in one place
- ❌ Global window functions for component communication

**✅ Recommended Patterns**:
- **Composition over Configuration**: Build complex UIs from small, focused components
- **Plugin Architecture**: Major features as swappable plugins with clean interfaces
- **Theme Awareness**: All UI elements consume theme context for swappable styling
- **Event-Driven Communication**: Use context and callbacks, not global state
- **Single Responsibility**: Each component has one clear purpose

## File Structure & Documentation Standards

### 🗂️ Complete Modular Architecture File Structure

**Root Level Organization:**
```
packages/web/src/
├── components/
│   ├── graph/                    # Complex feature modules
│   ├── ui/                       # Simple reusable components  
│   └── slick/                    # Slick dialog components
├── pages/                        # Route-level page components
├── hooks/                        # Shared business logic hooks
├── contexts/                     # React context providers
├── themes/                       # Theme configurations
├── types/                        # TypeScript type definitions
└── utils/                        # Pure utility functions
```

### 🎯 Graph Feature Module Structure (Reference Pattern)

```
packages/web/src/components/graph/
├── index.ts                      # Public API exports
├── README.md                     # Feature documentation
├── GraphView.tsx                 # Composition root (< 100 lines)
├── GraphEngine.tsx               # Core D3 logic (< 300 lines)  
├── GraphProvider.tsx             # Context & state management
├── GraphContext.ts               # TypeScript context definitions
├── hooks/
│   ├── index.ts                  # Hook exports
│   ├── useGraphState.ts          # State management (< 150 lines)
│   ├── useGraphTheme.ts          # Theme switching logic
│   ├── useGraphEvents.ts         # Event handling logic
│   └── useGraphAnimation.ts      # Animation utilities
├── plugins/
│   ├── index.ts                  # Plugin registry & exports
│   ├── PluginRenderer.tsx        # Plugin orchestration
│   ├── BasePlugin.types.ts       # Plugin interface definitions
│   ├── MiniMapPlugin/
│   │   ├── index.ts              # Plugin export
│   │   ├── MiniMapPlugin.tsx     # Main plugin component (< 200 lines)
│   │   ├── MiniMapCanvas.tsx     # Canvas rendering logic
│   │   ├── MiniMapControls.tsx   # Interactive controls
│   │   ├── MiniMapTheme.types.ts # Plugin-specific themes
│   │   └── README.md             # Plugin documentation
│   ├── NodeEditorPlugin/
│   │   ├── index.ts
│   │   ├── NodeEditorPlugin.tsx  # Slick editor component
│   │   ├── PropertyEditors/      # Individual property editors
│   │   │   ├── StatusEditor.tsx
│   │   │   ├── TypeEditor.tsx
│   │   │   └── PriorityEditor.tsx
│   │   └── README.md
│   └── RelationshipSelectorPlugin/
│       ├── index.ts
│       ├── RelationshipSelectorPlugin.tsx
│       ├── RelationshipOption.tsx
│       └── README.md
├── themes/
│   ├── index.ts                  # Theme exports
│   ├── GraphTheme.types.ts       # Theme interface definitions
│   ├── TropicalTheme.ts          # Default lagoon theme
│   ├── CosmicTheme.ts            # Space theme example
│   └── MinimalTheme.ts           # Clean theme example
├── utils/
│   ├── graphCalculations.ts      # Pure calculation functions
│   ├── d3Helpers.ts              # D3 utility functions
│   └── pluginHelpers.ts          # Plugin development utilities
└── types/
    ├── Graph.types.ts            # Core graph interfaces
    ├── Plugin.types.ts           # Plugin system types
    └── Theme.types.ts            # Theme system types
```

### 📋 Component Documentation Requirements

**Every component must include:**

#### 1. Component Header Documentation
```typescript
/**
 * MiniMapPlugin - Interactive mini-map overlay for graph navigation
 * 
 * @feature Graph Navigation
 * @complexity Medium (150 lines)
 * @dependencies GraphContext, Theme System
 * @plugin-priority 10
 * 
 * Provides real-time mini-map with:
 * - Node positioning visualization
 * - Viewport indicator with pan/zoom
 * - Swappable background themes
 * - Click-to-navigate functionality
 * 
 * @example
 * ```tsx
 * const plugins = [
 *   {
 *     ...MiniMapPlugin,
 *     config: { position: 'bottom-right', theme: 'cosmic' }
 *   }
 * ];
 * ```
 */
```

#### 2. Interface Documentation
```typescript
/**
 * Plugin configuration interface for MiniMap
 */
interface MiniMapPluginConfig {
  /** Position of mini-map overlay */
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Size variant */
  size: 'small' | 'medium' | 'large';
  /** Theme override */
  theme?: Partial<MiniMapTheme>;
  /** Enable/disable specific features */
  features: {
    nodeLabels: boolean;
    gridLines: boolean;
    panControls: boolean;
  };
}
```

#### 3. README.md for Each Module
```markdown
# MiniMapPlugin

Interactive navigation overlay for the graph visualization system.

## Features
- Real-time node position tracking
- Viewport visualization with pan/zoom controls
- Themeable backgrounds (lagoon, space, minimal)
- Click-to-navigate functionality

## Usage
```tsx
import { MiniMapPlugin } from './plugins/MiniMapPlugin';

const graphPlugins = [MiniMapPlugin];
```

## Theme Configuration
```typescript
const customTheme: MiniMapTheme = {
  background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
  nodeColors: { TASK: '#10b981', OUTCOME: '#3b82f6' },
  gridPattern: 'dots'
};
```

## Dependencies
- GraphContext for viewport state
- Theme system for styling
- D3 for coordinate transformations

## Performance Notes
- Uses requestAnimationFrame for smooth updates
- Debounced resize handling
- Optimized SVG rendering
```

### 🔌 Plugin Development Guidelines

#### Plugin Interface Contract
```typescript
interface GraphPlugin {
  /** Unique plugin identifier */
  id: string;
  /** Display name for plugin management UI */
  name: string;
  /** Plugin description */
  description: string;
  /** Semantic version */
  version: string;
  /** Z-index priority for overlay ordering */
  priority: number;
  /** Render function with access to graph context */
  render: (context: GraphContext) => React.ReactNode;
  /** Plugin configuration schema */
  configSchema?: PluginConfigSchema;
  /** Cleanup function for unmounting */
  cleanup?: () => void;
  /** Plugin dependencies */
  dependencies?: string[];
}
```

#### Plugin Development Checklist
- ✅ **Single Responsibility**: Plugin does one thing well
- ✅ **Theme Aware**: Consumes theme context for styling
- ✅ **Size Limit**: Individual plugins < 200 lines
- ✅ **Documentation**: README.md with usage examples
- ✅ **Type Safety**: Full TypeScript interfaces
- ✅ **Performance**: No unnecessary re-renders
- ✅ **Accessibility**: ARIA labels and keyboard navigation
- ✅ **Testing**: Unit tests for plugin logic

### 📏 File Size Limits & Guidelines

**Component Size Limits:**
- **Core Engine**: < 300 lines (pure D3 visualization)
- **Composition Root**: < 100 lines (plugin orchestration)
- **Individual Plugins**: < 200 lines (focused functionality)
- **Hook Files**: < 150 lines (single concern)
- **Theme Files**: < 100 lines (configuration only)

**When to Split Components:**
- More than 10 useState hooks → Extract custom hook
- More than 5 useEffect hooks → Consider splitting concerns
- More than 200 lines JSX → Break into sub-components
- Complex conditional rendering → Extract conditional components

### 🚀 Implementation Timeline & Migration Strategy

**Step 1: Preparation**
- Create `components/graph/` directory structure
- Set up plugin type definitions and interfaces
- Create base theme system

**Step 2: Core Engine Extraction**
- Extract pure D3 logic to `GraphEngine.tsx`
- Remove UI state management from visualization
- Create `GraphProvider` context system

**Step 3: Plugin System Foundation**
- Build `PluginRenderer` component
- Implement plugin priority/z-index system
- Create plugin development utilities

**Step 4: Major Plugin Extraction**
- Convert mini-map to `MiniMapPlugin`
- Convert node editing to `NodeEditorPlugin`  
- Convert relationship selector to plugin

**Step 5: Theme Integration**
- Connect plugins to theme system
- Test theme switching functionality
- Document theme development

**Step 6: Testing & Documentation**
- Write plugin unit tests
- Complete all README.md files
- Validate architectural goals


### 5. Theme Pack System Implementation
- [ ] **Extract theme configuration** to separate theme manifest files
- [ ] **Implement dynamic theme loading** mechanism
- [ ] **Create theme pack validation** and hot-reloading system
- [ ] **Document theme pack creation guide** for community contributions
- [ ] **Build theme pack marketplace** integration points

### 6. Visual Language Consistency (High Priority)
- [x] **Workspace**: Implement complete three-section top bar pattern
- [x] **Layout**: Universal transparent sidebar with lagoon background
- [ ] **Ontology page**: Add transparent top bar with three-section layout
- [ ] **AI & Agents page**: Implement visual consistency with workspace pattern
- [ ] **Analytics page**: Add top bar three-section layout with center mode buttons
- [ ] **Settings page**: Integrate transparent styling and backdrop blur
- [ ] **Admin page**: Apply workspace visual language consistently  
- [ ] **Backend Status page**: Add top bar with right-aligned status indicators

### 7. Design Language Final Polish
- [x] Transform Dashboard with modern card-based layout and themed gradients
- [x] Transform RightSidebar with dynamic CardView styling
- [x] Standardize hover effects across project
- [ ] **Migrate all remaining heavy modals** to slick contextual patterns
- [ ] **Ensure consistent backdrop blur** across all UI elements
- [ ] **Audit for solid backgrounds** that block lagoon animation

### 8. Authentication System Enhancement
- [x] Remove PostgreSQL/Prisma dependencies
- [x] Implement direct Neo4j authentication
- [ ] Test and complete GitHub and LinkedIn OAuth providers (code exists but needs testing)
- [ ] Add user profile management UI using slick dialog patterns
- [ ] Implement team invitation flow with contextual overlays
- [ ] Add role-based access control

### 9. Graph Conceptual Model Clarity
- [ ] Improve graph selector to show filter details (not just name)
- [ ] Add filter indicators showing what criteria define each graph
- [ ] Implement graph templates for common filter patterns
- [ ] Better onboarding to explain graphs-as-filters concept

### 10. Performance and Scalability
- [ ] Optimize D3.js force simulation for large graphs
- [ ] Implement virtual scrolling in table and card views
- [ ] Add pagination for GraphQL queries
- [ ] Optimize bundle size with code splitting
- [ ] Add service worker for offline support

## Graph View Architecture Crisis & Refactoring Strategy

### 🚨 Current Architectural Problems

**The Monolithic Graph Component Crisis:**
- **4,015 lines** in `InteractiveGraphVisualization.tsx`
- **50+ hooks** (useState, useEffect, useMutation, useQuery)
- **25+ state variables** managing everything from modals to mini-maps
- **Massive render method** with complex conditional JSX
- **Tight coupling** between D3 visualization, UI overlays, and business logic
- **Global window functions** for communication between components

**Specific Issues:**
```typescript
// Current state explosion in InteractiveGraphVisualization.tsx:199-225
const [nodeMenu, setNodeMenu] = useState<NodeMenuState>({...});
const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState>({...});
const [isConnecting, setIsConnecting] = useState(false);
const [selectedRelationType, setSelectedRelationType] = useState<RelationshipType>('DEFAULT_EDGE');
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [showCreateNodeModal, setShowCreateNodeModal] = useState(false);
const [showNodeDetailsModal, setShowNodeDetailsModal] = useState(false);
const [showConnectModal, setShowConnectModal] = useState(false);
// ... 15+ more modal states
const [showDataHealth, setShowDataHealth] = useState(false);
const [selectedNode, setSelectedNode] = useState<WorkItem | null>(null);
const [selectedEdge, setSelectedEdge] = useState<WorkItemEdge | null>(null);
// ... Mini-map communication via global window functions
```

### 🏗️ Proposed Modular Architecture

**Core Principle**: **Composition over Configuration** with **Plugin-Style Architecture**

#### 1. Base Graph Engine (Core Visualization)

```typescript
// packages/web/src/components/graph/GraphEngine.tsx
interface GraphEngineProps {
  nodes: WorkItem[];
  edges: WorkItemEdge[];
  onNodeSelect?: (node: WorkItem) => void;
  onEdgeSelect?: (edge: WorkItemEdge) => void;
  onBackgroundClick?: (position: {x: number, y: number}) => void;
  children?: React.ReactNode; // For overlay plugins
}

const GraphEngine = ({ nodes, edges, onNodeSelect, onEdgeSelect, children }: GraphEngineProps) => {
  // Pure D3 visualization logic only
  // Emit events, don't manage UI state
  // Provide context for position/zoom state
};
```

#### 2. Plugin System for Overlays

```typescript
// packages/web/src/components/graph/plugins/
interface GraphPlugin {
  id: string;
  render: (context: GraphContext) => React.ReactNode;
  priority: number; // z-index ordering
}

interface GraphContext {
  selectedNode: WorkItem | null;
  selectedEdge: WorkItemEdge | null;
  viewportTransform: Transform;
  graphBounds: Bounds;
  theme: ThemeConfig;
}
```

**Plugin Examples:**
```typescript
// MiniMapPlugin.tsx - Swappable themes/backgrounds
const MiniMapPlugin: GraphPlugin = {
  id: 'minimap',
  priority: 10,
  render: (context) => (
    <MiniMap 
      context={context}
      theme={context.theme.miniMap} // Swappable backgrounds
      position="bottom-right"
    />
  )
};

// NodeContextMenuPlugin.tsx
const NodeContextMenuPlugin: GraphPlugin = {
  id: 'node-menu',
  priority: 100,
  render: (context) => context.selectedNode ? (
    <SlickNodeEditor 
      node={context.selectedNode}
      position={getNodeScreenPosition(context.selectedNode)}
      theme={context.theme.nodeEditor}
    />
  ) : null
};

// RelationshipSelectorPlugin.tsx  
const RelationshipSelectorPlugin: GraphPlugin = {
  id: 'relationship-selector',
  priority: 50,
  render: (context) => context.isConnecting ? (
    <SlickRelationshipSelector
      theme={context.theme.relationshipSelector}
      position="center-top"
    />
  ) : null
};
```

#### 3. Composed Graph View

```typescript
// packages/web/src/components/graph/GraphView.tsx
const GraphView = ({ theme = defaultTheme }: { theme?: GraphTheme }) => {
  const plugins = [
    MiniMapPlugin,
    NodeContextMenuPlugin, 
    RelationshipSelectorPlugin,
    DataHealthPlugin,
    // Easy to add/remove/reorder
  ];

  return (
    <GraphProvider theme={theme}>
      <GraphEngine>
        <PluginRenderer plugins={plugins} />
      </GraphEngine>
    </GraphProvider>
  );
};
```

#### 4. Theme-Aware Plugin System

```typescript
// packages/web/src/themes/GraphTheme.ts
interface GraphTheme {
  background: 'lagoon' | 'space' | 'minimal';
  miniMap: {
    background: string;
    nodeColors: Record<WorkItemType, string>;
    gridPattern: 'dots' | 'lines' | 'none';
  };
  nodeEditor: {
    backdropBlur: string;
    backgroundColor: string;
    borderRadius: string;
  };
  relationshipSelector: {
    layout: 'vertical' | 'horizontal' | 'grid';
    animations: boolean;
  };
}

// Swappable theme packs
const themes = {
  tropical: { background: 'lagoon', miniMap: { background: 'caustic-blue' } },
  cosmic: { background: 'space', miniMap: { background: 'star-field' } },
  minimal: { background: 'minimal', miniMap: { background: 'clean-grid' } }
};
```

#### 5. Clean State Management

```typescript
// packages/web/src/hooks/useGraphState.ts
const useGraphState = () => {
  const [selectedNode, setSelectedNode] = useState<WorkItem | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<WorkItemEdge | null>(null);
  const [viewportTransform, setViewportTransform] = useState<Transform>(identity);
  
  // Centralized state, distributed via context
  return {
    selectedNode, setSelectedNode,
    selectedEdge, setSelectedEdge,
    viewportTransform, setViewportTransform,
    // Clean event handlers
    handleNodeSelect: (node: WorkItem) => setSelectedNode(node),
    handleEdgeSelect: (edge: WorkItemEdge) => setSelectedEdge(edge),
    handleBackgroundClick: () => {
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  };
};
```

### 🎯 Refactoring Strategy

**Phase 1: Extract Core Engine**
- Move pure D3 visualization logic to `GraphEngine.tsx`
- Remove all UI state management from D3 component
- Create clean event-based API

**Phase 2: Plugin-ify Major Features**
- Extract mini-map as `MiniMapPlugin`
- Extract node editing as `NodeEditorPlugin`
- Extract relationship selector as `RelationshipPlugin`

**Phase 3: Theme System Integration**
- Create swappable theme configurations
- Allow plugins to consume theme context
- Enable runtime theme switching

**Phase 4: Advanced Composition**
- Plugin dependency system
- Plugin configuration UI
- User-customizable plugin layouts

## Implementation Guidelines for Slick Dialogs

**🎯 When creating new dialogs, follow these patterns:**

### ✅ DO: Slick Contextual Pattern
```jsx
// Position near the element being edited
const SlickPropertyEditor = ({ position, onClose, initialValue }) => {
  return createPortal(
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999999]">
      <div 
        className="absolute bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        {/* Immediate visual feedback */}
        {options.map((option, index) => (
          <button
            key={option.id}
            className="hover:scale-105 transition-all duration-200"
            style={{ animationDelay: `${index * 30}ms` }}
            onClick={() => updateImmediately(option)}
          >
            {/* Rich content with gradients */}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
};
```

### ❌ DON'T: Heavy Modal Pattern
```jsx
// Avoid full-screen modals for simple property changes
const HeavyEditModal = ({ isOpen, onSave, onCancel }) => (
  <div className="fixed inset-0 bg-black/75 z-50">
    <div className="max-w-md mx-auto mt-20 bg-white rounded-lg">
      <form onSubmit={handleSubmit}>
        {/* Multiple form fields */}
        <button type="submit">Save Changes</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </form>
    </div>
  </div>
);
```

**Key Differences:**
- **Positioning**: Near element vs center screen
- **Feedback**: Immediate vs delayed (save button)
- **Visual weight**: Minimal chrome vs heavy borders/headers
- **Interaction model**: Direct manipulation vs form submission

## Common Gotchas

1. **Neo4j Connection**: Ensure Docker is running and Neo4j is accessible on port 7687
2. **Dialog Positioning**: Always use `createPortal(element, document.body)` for overlays to avoid z-index conflicts
3. **Slick Dialog z-index**: Use `z-[999999]` string value for maximum overlay priority
4. **Dialog Manager Integration**: Register all dialogs with `useDialog` hook for click-outside-to-close
5. **Immediate Updates**: For slick dialogs, update both local state and GraphQL immediately (optimistic updates)
6. **Animation Performance**: Use `transform` and `opacity` for animations, avoid layout-affecting properties
7. **Gradient Classes**: Use static Tailwind classes from gradient maps, not dynamic interpolation
8. **Backdrop Blur**: Combine `backdrop-blur-sm` with semi-transparent backgrounds for depth
9. **Hot Reloading**: Vite HMR requires manual refresh after GraphQL schema changes
10. **D3.js Integration**: Force simulation requires careful cleanup in React useEffect hooks

## 🚨 Production Readiness & Security

### ✅ **COMPLETED**: TLS/HTTPS Implementation
- **Documentation**: [docs/tls-ssl-setup.md](./docs/tls-ssl-setup.md)
- **Current Status**: **PRODUCTION READY** with TLS/SSL support
- **Features**: HTTP/HTTPS dual mode, development certificates, Docker HTTPS support

### **TLS/SSL Features Implemented**:
- ✅ **HTTPS/TLS encryption** for GraphQL API and WebSocket connections
- ✅ **Development certificates** via `./scripts/generate-dev-certs.sh`
- ✅ **Docker HTTPS support** with `docker-compose.https.yml`
- ✅ **Automatic protocol detection** (HTTP ↔ HTTPS, WS ↔ WSS)
- ✅ **Comprehensive testing** (unit tests, E2E tests, integration testing)
- ✅ **Production configuration** for CA-signed certificates

### **Quick HTTPS Setup**:
```bash
# Generate development certificates
./scripts/generate-dev-certs.sh

# Enable SSL in .env
SSL_ENABLED=true
SSL_KEY_PATH=./certs/dev-key.pem  
SSL_CERT_PATH=./certs/dev-cert.pem
HTTPS_PORT=4128

# Start with HTTPS
npm run dev
# Server available at: https://localhost:4128/graphql
```

### **Remaining Security Enhancements**:
1. **Secure secrets management** (Docker secrets, environment variables)
2. **Database encryption** (Neo4j TLS, Redis TLS)  
3. **Security headers** (HSTS, CSP, etc.)
4. **Production certificate automation** (Let's Encrypt integration)

### **Current Configuration Status**:
```bash
# ✅ SECURE (configurable):
SSL_ENABLED=true                          # HTTPS encryption available
HTTPS_PORT=4128                           # Dedicated HTTPS port

# ⚠️  REQUIRES PRODUCTION UPDATES:
NEO4J_AUTH: neo4j/graphdone_password      # Change for production
JWT_SECRET=your-secret-key-change-this    # Generate secure secret
CORS_ORIGIN=https://localhost:3128        # Update for production domain
```

## URLs and Services

**Production Environment (Default - HTTPS):**
- Web Application: https://localhost:3128 ✅ HTTPS
- GraphQL API: https://localhost:4128/graphql ✅ HTTPS
- WebSocket: wss://localhost:4128/graphql ✅ Secure WebSocket
- Health Check: https://localhost:4128/health ✅ HTTPS
- Neo4j Browser: http://localhost:7474 (neo4j/graphdone_password)
- HTTP Redirect: http://localhost:3127 → https://localhost:3128

**Development Environment (--dev flag - HTTP only):**
- Web Application: http://localhost:3127
- GraphQL API: http://localhost:4127/graphql
- WebSocket: ws://localhost:4127/graphql  
- Health Check: http://localhost:4127/health
- Neo4j Browser: http://localhost:7474
- MCP Server: http://localhost:3128 (optional)

**Remote Production Environment:**
- Web Application: https://your-domain.com ✅ HTTPS
- GraphQL API: https://your-domain.com/graphql ✅ HTTPS  
- WebSocket: wss://your-domain.com/graphql ✅ Secure WebSocket
- Neo4j Browser: https://your-domain.com:7473 ✅ HTTPS

## Claude Code Integration

The MCP server in `packages/mcp-server/` provides natural language access to your GraphDone graph:

```bash
# Build and register MCP server
./scripts/setup-mcp.sh

# Manual registration
cd packages/mcp-server && npm run build
claude mcp add graphdone node dist/index.js \
  --env "NEO4J_URI=bolt://localhost:7687" \
  --env "NEO4J_USER=neo4j" \
  --env "NEO4J_PASSWORD=graphdone_password"
```

## Development Best Practices & Lessons Learned

### Certificate Management

**CRITICAL**: Never commit certificates to the repository. All certificates are generated on-demand:

```bash
# Generate development certificates (when needed)
./scripts/generate-dev-certs.sh

# Certificate files are in .gitignore and should never be committed
# Empty .gitkeep files document the certificate directories
```

**Certificate Script Issues Fixed:**
- Changed `rm "$CERT_DIR/dev-csr.pem"` to `rm -f "$CERT_DIR/dev-csr.pem"` to prevent warnings when file doesn't exist

### Build and Dependency Management

**NPM Dependency Issues:**
- Use `npm install --legacy-peer-deps` when ESLint version conflicts occur
- ESLint 9.x has compatibility issues with older React plugins
- Most deprecated package warnings are upstream dependencies that will be resolved by maintainers

**Browser/Node.js Compatibility:**
```typescript
// WRONG: NodeJS.Timeout in browser environments
const intervalRef = useRef<NodeJS.Timeout>();

// CORRECT: Use number type with proper casting
const intervalRef = useRef<number>();
intervalRef.current = setInterval(callback, interval) as unknown as number;
```

### Lucide React Icon Issues

**CRITICAL**: Lucide React icons do NOT support `title` props:

```typescript
// WRONG: TypeScript will fail
<CheckCircle className="h-5 w-5" title="Description" />

// CORRECT: Remove title prop
<CheckCircle className="h-5 w-5" />

// Use wrapper div or aria-label if needed for accessibility
<div title="Description">
  <CheckCircle className="h-5 w-5" />
</div>
```

### Test Quality Standards

**CRITICAL**: No fake or cheating tests allowed. Common anti-patterns found and fixed:

```typescript
// WRONG: Fake assertions that always pass
expect(true).toBe(true);

// CORRECT: Meaningful validation
expect(result).toBeDefined();
expect(result.content).toBeDefined();
expect(Array.isArray(result.content)).toBe(true);

// WRONG: Skip pattern with fake assertion
it('should skip when no database', () => {
  expect(true).toBe(true);
});

// CORRECT: Proper test skipping
it.skip('should skip when no database', () => {
  // Clear skip reason in comment
});
```

**Test Quality Checklist:**
- ✅ All assertions validate actual behavior or data structure
- ✅ Skip patterns use `test.skip()` instead of fake assertions
- ✅ Error recovery tests validate response structure, not just "didn't throw"
- ✅ Informational tests check data types and array structures
- ✅ No `expect(true).toBe(true)` patterns anywhere

### Clean Environment Testing Procedures

**CRITICAL**: Always test with completely clean environments:

```bash
# Complete clean start (removes all volumes, containers, dependencies)
./start remove
echo "yes" | ./start remove  # Non-interactive

# Fresh development setup
./start dev

# Fresh production build
./start build
```

**Docker Issues:**
- Docker Desktop must be running for clean environment tests
- Use `docker system prune -f --volumes` for complete cleanup
- Container startup can take 30+ seconds, allow time for Neo4j readiness

### TLS/SSL Testing Integration

**Certificate Generation is Now On-Demand:**
- No certificates stored in repository
- `scripts/generate-dev-certs.sh` creates development certificates
- `scripts/test-cert-security.sh` validates certificate security
- TLS integration tests moved to `tests/e2e/tls-integration.spec.ts`

**Playwright Browser Management:**
```bash
# Install missing browsers (required after clean setup)
npx playwright install

# Browsers needed: Chromium, Firefox, WebKit
# Firefox and WebKit often missing after fresh installs
```

### Repository Cleanup Patterns

**File Organization Learned:**
- Move test utilities to `scripts/testing/` subdirectory
- Certificate scripts go in `scripts/` (not tools/)
- E2E tests belong in `tests/e2e/` (not top-level e2e/)
- Use `.gitkeep` files to document empty but necessary directories

**Safe Integration Patterns:**
1. **Read and understand** existing files before moving
2. **Test functionality** of moved scripts
3. **Update any hardcoded paths** after moving
4. **Verify tests still pass** after reorganization
5. **Remove only after confirming** new locations work

## Troubleshooting Common Issues

### Build Failures
- **ESLint Errors**: Check for `NodeJS` type usage in browser code
- **TypeScript Errors**: Verify Lucide icon props don't include `title`
- **Test Failures**: Ensure no fake assertions remain (`expect(true).toBe(true)`)

### Docker Issues
- **Connection Refused**: Docker Desktop may not be fully started, wait 15+ seconds
- **Port Conflicts**: Use `./start stop` to clean up running services
- **Volume Issues**: Use `./start remove` for complete cleanup

### Certificate Issues
- **File Not Found**: Run `./scripts/generate-dev-certs.sh` to create certificates
- **Permission Denied**: Certificates have correct permissions (600 for keys, 644 for certs)
- **Browser Warnings**: Development certificates are self-signed, warnings expected