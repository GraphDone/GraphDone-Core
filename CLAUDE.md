# CLAUDE.md

This file provides guidance to Claude Code when working with GraphDone-Core.

## Project Overview

GraphDone is a graph-native project management system that reimagines work coordination through dependencies and democratic prioritization rather than hierarchical assignments. Currently in active development (v0.3.1-alpha) with TLS/SSL production readiness.

## Core Philosophy

- Work flows through natural dependencies, not artificial hierarchies
- Ideas migrate from periphery to center based on community validation and democratic prioritization
- Human and AI agents collaborate as peers through the same graph interface
- Designed for neurodivergent individuals and those who think differently about work

## Quick Start

```bash
# Production HTTPS deployment (default)
./start deploy

# Development HTTP environment  
./start dev

# Clean environment setup
./start
```

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

### Web Application (`packages/web/`)

**Component Architecture:**
- `InteractiveGraphVisualization` - Enhanced D3.js force-directed graph (4,015 lines - needs refactoring)
- `SafeGraphVisualization` - Error-boundary wrapped graph visualization
- `ViewManager` - Orchestrates dashboard, table, kanban, gantt, calendar, and card views
- `Workspace` - Main layout with graph selector, view modes, and data issues tracking
- `useDialogManager` - Centralized hook for managing all dialogs/overlays lifecycle

## Development Commands

### Essential Commands
```bash
npm run dev         # Start development servers (web :3127, API :4127)
npm run test        # All tests including E2E
npm run build       # Production build
npm run lint        # ESLint all packages
npm run typecheck   # TypeScript validation
```

### Database Operations
```bash
npm run db:seed     # Seed Neo4j with sample data (32 work items + relationships)
# Neo4j Browser: http://localhost:7474 (neo4j/graphdone_password)
```

### Version Management
```bash
# Update version across entire project
./scripts/update-version-minimal.sh 0.3.2-alpha
npm install
git add . && git commit -m "Update version to v0.3.2-alpha"
```

## Testing Strategy

**🔑 Authentication System for E2E Tests:**
GraphDone includes a comprehensive, battle-tested authentication system for E2E tests in `tests/helpers/auth.ts`. **This is the foundation for all E2E testing** and should be used by every test that requires user authentication.

```typescript
import { login, navigateToWorkspace, TEST_USERS } from '../helpers/auth';

test('my feature test', async ({ page }) => {
  // Robust cross-browser authentication
  await login(page, TEST_USERS.ADMIN);
  await navigateToWorkspace(page);
  // Your test code here - fully authenticated!
});
```

**Key Features:**
- ✅ **Cross-browser tested** (Chromium, Firefox, WebKit)
- ✅ **Handles all edge cases** (connection failures, timeouts, UI changes)
- ✅ **Smart retry logic** with exponential backoff
- ✅ **Comprehensive logging** for easy debugging

**Test Commands:**
```bash
npm run test              # All tests including E2E
npm run test:unit         # Unit tests only  
npm run test:e2e          # E2E tests only
npm run test:coverage     # With coverage report
```

### **Comprehensive Test Infrastructure Status**

**🎯 Test Runner & Reporting:**
- ✅ **Unified test runner** via `./start test` or `npm run test:comprehensive`
- ✅ **Beautiful HTML reports** with GraphDone branding and expandable sections
- ✅ **CI/CD integration** with GitHub Actions workflow
- ✅ **Real-time error analysis** with detailed failure reporting

**📊 Current Test Results (as of 2025-09-10):**
- **Total Tests**: 15 across 8 test suites
- **Passing**: TLS/SSL Integration ✅, Database Connectivity ✅ (3/15 tests)
- **Failing**: Authentication, UI, Workspace, Real-time Updates (6/15 tests)
- **Critical Issues Identified**: 
  - Authentication logout flow needs improvement
  - UI flexibility issues with viewport and touch interactions
  - Navigation URL handling in Playwright tests

**🔧 Recent Fixes Applied:**
- ✅ **HTTPS Certificate Deployment**: Fixed certificate paths and script references
- ✅ **Playwright Configuration**: Added proper `ignoreHTTPSErrors` and base URL
- ✅ **TLS Integration Tests**: Now passing with correct certificate paths
- ✅ **Test Report UI**: Enhanced with GraphDone logo, expandable sections, and error details
- ✅ **.gitignore Configuration**: Include dev certificates while excluding production certificates
- ✅ **Documentation Updates**: All TLS/SSL setup docs now use correct certificate paths

**⚠️ Known UI Flexibility Issues:**
The automated testing has revealed important UI inflexibility issues that need addressing:
1. **Element Positioning**: Components positioned outside viewport during mobile/responsive testing
2. **Touch Interactions**: Timeout failures on touch events, especially on mobile emulation
3. **Authentication Flow**: Logout button detection failing, session persistence issues
4. **Navigation**: Base URL handling inconsistencies between HTTP/HTTPS modes

**🚀 Usage:**
```bash
# Run comprehensive tests with beautiful HTML report
./start test

# View interactive report
make test-report
# or
open test-results/reports/index.html
```

**🔐 HTTPS/TLS Testing Setup (for next developer):**
```bash
# 1. Generate development certificates (required for TLS tests)
./scripts/generate-dev-certs.sh

# 2. Verify certificates were created
ls -la deployment/certs/
# Should show: server-key.pem and server-cert.pem

# 3. Enable HTTPS in environment (.env file)
SSL_ENABLED=true
SSL_KEY_PATH=./deployment/certs/server-key.pem
SSL_CERT_PATH=./deployment/certs/server-cert.pem
HTTPS_PORT=4128

# 4. Run TLS-specific tests
npm run test:e2e -- tests/e2e/tls-integration.spec.ts

# 5. Run all E2E tests including HTTPS scenarios
npm run test:e2e
```

**❗ Important Notes for Testing:**
- **Development certificates are included in the repository** (via .gitignore exceptions) for automated testing
- **Certificate paths must use** `deployment/certs/server-*.pem` format (not `certs/` or other locations)
- **Playwright automatically ignores HTTPS errors** for development certificates
- **TLS tests will skip in CI environments** where certificates are not available

## Current UI Architecture

### Visual Language Consistency: The Calm Environment System

GraphDone implements a **cohesive visual language** designed to create a calm, unified environment rather than aggressive full-screen takeovers. All pages follow consistent patterns to maintain visual harmony with the tropical lagoon background.

### The Three-Section Top Bar Pattern

**🎯 Standard Layout**: Every page should implement this top bar structure:

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

### Dialog Manager System

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

## Security & Production Readiness

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
SSL_KEY_PATH=./deployment/certs/server-key.pem  
SSL_CERT_PATH=./deployment/certs/server-cert.pem
HTTPS_PORT=4128

# Start with HTTPS
npm run dev
# Server available at: https://localhost:4128/graphql
```

## Current Development Priorities

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

### 3. Visual Language Consistency (High Priority)
- [x] **Workspace**: Implement complete three-section top bar pattern
- [x] **Layout**: Universal transparent sidebar with lagoon background
- [ ] **Ontology page**: Add transparent top bar with three-section layout
- [ ] **AI & Agents page**: Implement visual consistency with workspace pattern
- [ ] **Analytics page**: Add top bar three-section layout with center mode buttons
- [ ] **Settings page**: Integrate transparent styling and backdrop blur
- [ ] **Admin page**: Apply workspace visual language consistently  
- [ ] **Backend Status page**: Add top bar with right-aligned status indicators

## File Organization (Recently Cleaned)

**Organized Structure:**
```
artifacts/
├── screenshots/     # All .png files moved here
├── test-reports/    # Playwright reports and test artifacts  
└── certificates/    # Test certificates

tests/
├── e2e/            # All E2E test specs
├── helpers/        # Authentication system
└── *.js            # Moved test files from root level
```

**Clean Patterns:**
- Test files belong in `tests/` directory
- Screenshots go in `artifacts/screenshots/`
- No loose files at repository root
- Certificate management consolidated

## Key Implementation Guidelines

### Following conventions
When making changes to files, first understand the file's code conventions. Mimic code style, use existing libraries and utilities, and follow existing patterns.
- NEVER assume that a given library is available, even if it is well known. Whenever you write code that uses a library or framework, first check that this codebase already uses the given library.
- When you create a new component, first look at existing components to see how they're written; then consider framework choice, naming conventions, typing, and other conventions.
- When you edit a piece of code, first look at the code's surrounding context (especially its imports) to understand the code's choice of frameworks and libraries.
- Always follow security best practices. Never introduce code that exposes or logs secrets and keys. Never commit secrets or keys to the repository.

### Code style
- IMPORTANT: DO NOT ADD ***ANY*** COMMENTS unless asked

### Theme System
Centralized gradients and colors in `workItemConstants.tsx`:
```typescript
export const getTypeGradientBackground = (type: WorkItemType, style: GradientStyle): string => {
  // Static Tailwind classes for compilation
};
```

### Authentication for Tests
Use the comprehensive auth system in `tests/helpers/auth.ts` for all E2E tests requiring login.

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
11. **Version Updates**: Use `./scripts/update-version-minimal.sh` to update version across project. See [docs/version-management.md](./docs/version-management.md) for details.

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

## Philosophy

"You are building tools that help everyone. Take it seriously, take pride in your work, don't fake tests, we are building open source software which will help people connect with each other and work together."

The future is decentralized, free, and compassionate. This guides all architectural decisions toward democratic coordination rather than hierarchical control.