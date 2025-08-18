# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GraphDone is a graph-native project management system that reimagines work coordination through dependencies and democratic prioritization rather than hierarchical assignments. The project is in active development (v0.1.0-alpha) with core architecture implemented and working foundation.

## Core Philosophy

- Work flows through natural dependencies, not artificial hierarchies
- Ideas migrate from periphery to center based on community validation and democratic prioritization
- Human and AI agents collaborate as peers through the same graph interface
- Designed for neurodivergent individuals and those who think differently about work

## Planned Architecture

### Technology Stack
- **Frontend**: React 18 with TypeScript, React Native for mobile, D3.js for graph visualization
- **Backend**: Node.js with TypeScript, GraphQL with Apollo Server, Neo4j with @neo4j/graphql
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Real-time**: WebSocket subscriptions
- **Infrastructure**: Docker, Kubernetes, GitHub Actions for CI/CD
- **Testing**: Playwright for E2E testing, Vitest for unit tests

### Project Structure (Implemented)
```
packages/
├── core/           # Graph engine and algorithms (✅ Complete)
├── web/            # React web application (✅ Complete)
├── server/         # GraphQL API server (✅ Complete)
└── agent-sdk/      # SDK for AI agent integration (🔄 Planned)

Additional:
├── docs/           # Comprehensive documentation
├── scripts/        # Development and deployment scripts
└── .github/        # CI/CD workflows
```

## Development Commands

The project has a fully implemented monorepo structure with these commands:

```bash
# Quick setup (recommended)
./tools/setup.sh                    # Complete environment setup
./tools/run.sh                      # Start all development servers

# Manual setup
npm install                   # Install dependencies
cp .env.example .env          # Create environment file
docker-compose up -d postgres # Start PostgreSQL
npm run db:migrate            # Run database migrations

# Development
npm run dev                   # Start all development servers (Turbo)
npm run test                  # Run all tests
npm run lint                  # Lint all packages
npm run typecheck             # Type check all packages
npm run build                 # Build all packages

# Database operations
npm run db:seed               # Seed Neo4j database with test data

# Docker development
docker-compose -f deployment/docker-compose.dev.yml up  # With hot reload
docker-compose up             # Production-like environment
```

## Key Concepts

### Graph Structure
- **Nodes**: Outcomes, tasks, milestones, contributors (human and AI)
- **Edges**: Dependencies, relationships, priorities
- **Spherical Coordinates**: 3D positioning based on priority (center = highest priority)

### Priority System
- Executive flags create gravity wells but don't control entire structure
- Individual contributors can establish small gravity wells on periphery
- Anonymous democratic rating system for idea validation
- Priority determines resource allocation and position in spherical model

### Agent Integration
Agents are first-class citizens that:
- Read/write graph state through standard GraphQL endpoints
- Receive real-time notifications for graph changes
- Request compute resources based on node priority
- Coordinate with humans through the same interface

## Implementation Guidelines

When implementing features:

1. **Graph-First Design**: All features should work within the graph paradigm
2. **Mobile-First UI**: Touch interactions must be primary, not an afterthought
3. **Agent Parity**: Any action a human can take, an agent should be able to take via API
4. **Democratic by Default**: Community validation mechanisms should be built into core features
5. **Accessibility**: Design for neurodiversity and different cognitive styles

## Development Commands

```bash
# Initial setup
./tools/setup.sh                    # Set up development environment
./tools/run.sh                      # Start development servers
./tools/test.sh                     # Run test suite with linting and type checking
./tools/build.sh                    # Build all packages
./tools/deploy.sh                   # Deploy to staging/production
./tools/document.sh                 # Generate and deploy documentation

# Docker development
./tools/run.sh --docker-dev         # Start with Docker (development)
./tools/run.sh --docker             # Start with Docker (production)

# Package-specific testing
./tools/test.sh --package core      # Test specific package
./tools/test.sh --coverage          # Run with coverage report
./tools/test.sh --watch             # Run in watch mode

# Turbo commands (alternative)
npm run dev                   # Start all development servers
npm run build                 # Build all packages
npm run test                  # Run all tests
npm run lint                  # Lint all packages
npm run typecheck             # Type check all packages
```

## Current Implementation Status

✅ **Completed:**
- Monorepo structure with Turbo for build orchestration
- Core graph engine with Node, Edge, Priority calculation, and full graph operations
- Neo4j integration with @neo4j/graphql auto-generated resolvers
- GraphQL API server with comprehensive schema and WebSocket subscriptions
- React web application with D3.js graph visualization and user-friendly error handling
- TypeScript configuration across all packages
- Playwright and Vitest testing infrastructure with E2E tests
- Docker development and production configurations with Neo4j 5.15-community
- Enhanced development scripts with automatic dependency management
- GitHub Actions CI/CD workflows for testing, building, and deployment
- Comprehensive documentation structure and branding (favicon, logos)

🏗️ **Architecture Implemented:**
- `packages/core/` - Graph engine with priority calculation, node/edge management, path finding, cycle detection
- `packages/server/` - GraphQL API with Neo4j schema, Apollo Server with @neo4j/graphql, WebSocket subscriptions
- `packages/web/` - React app with Vite, Tailwind CSS, D3.js visualization, Apollo Client, enhanced error handling
- Docker configurations for development and production with Neo4j 5.15-community
- Kubernetes-ready manifests (planned in deployment docs)
- Full CI/CD pipeline with testing, security scanning, and deployment
- Production deployment verified and tested

🎯 **Ready for Development:**
All foundation pieces are in place. To continue development:
1. Run `./start` to initialize the development environment automatically
2. Access the working application at http://localhost:3127
3. Use GraphQL Playground at http://localhost:4127/graphql
4. Backend status at http://localhost:3127/backend shows Neo4j architecture
5. Begin implementing specific features using the established patterns
6. Add more comprehensive tests using the Playwright and Vitest setup
7. Enhance the Neo4j schema and GraphQL resolvers as needed

## Core Architecture

### Graph Engine (`packages/core/`)
The heart of GraphDone is a custom graph engine with these key classes:

- **Graph**: Main graph container with nodes/edges, adjacency lists, pathfinding, cycle detection
- **Node**: Individual graph nodes with priority calculation, spherical positioning 
- **Edge**: Connections between nodes with types (DEPENDENCY, BLOCKS, etc.)
- **Priority**: Multi-dimensional priority system (executive, individual, community)
- **PriorityCalculator**: Algorithms for computing weighted priorities and spherical positions

Key files:
- `packages/core/src/graph.ts` - Main Graph class with all operations
- `packages/core/src/node.ts` - Node implementation with priority management
- `packages/core/src/priority.ts` - Priority calculation logic
- `packages/core/src/types.ts` - TypeScript definitions

### GraphQL API (`packages/server/`)
Apollo Server with real-time subscriptions:

- **Database**: Neo4j 5.15-community with APOC plugins
- **Schema**: Auto-generated GraphQL schema with @neo4j/graphql
- **Resolvers**: Automatically generated from Neo4j schema
- **Subscriptions**: Real-time WebSocket updates
- **Health Check**: `/health` endpoint for monitoring

Key files:
- `packages/server/src/index.ts` - Apollo Server setup with WebSocket support
- `packages/server/src/schema/neo4j-schema.ts` - Neo4j GraphQL schema definitions
- `packages/server/src/scripts/seed.ts` - Database seeding script
- `packages/server/src/context.ts` - GraphQL context with Neo4j driver

### Web Application (`packages/web/`)
React app with D3.js visualization:

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Visualization**: D3.js for interactive graph rendering
- **State**: Apollo Client for GraphQL state management
- **Routing**: React Router for navigation

Key files:
- `packages/web/src/App.tsx` - Main application router
- `packages/web/src/components/GraphVisualization.tsx` - D3.js graph component
- `packages/web/src/lib/apollo.ts` - GraphQL client configuration

## Testing Strategy

All packages use Vitest for testing:

```bash
# Run all tests
npm run test

# Run specific package tests
npm run test --filter=@graphdone/core
npm run test --filter=@graphdone/server
npm run test --filter=@graphdone/web

# Run with coverage
npm run test -- --coverage
```

Current test files:
- `packages/core/tests/` - Graph engine unit tests
- `packages/server/tests/` - API integration tests
- `packages/web/src/test/` - React component tests

## Database Schema

Neo4j with these main node types and relationships:
- **WorkItem**: Graph nodes with spherical coordinates and priorities  
- **Edge**: Connections between nodes with types (DEPENDS_ON, BLOCKS, etc.)
- **Contributor**: Users and AI agents in the system
- **WORKS_ON**: Relationships between contributors and work items

Key database operations:
```bash
npm run db:seed       # Add test data with 32 work items and relationships
# Access Neo4j Browser at http://localhost:7474 (neo4j/graphdone_password)
```

## Package-Specific Commands

### Core Package (`packages/core/`)
```bash
cd packages/core
npm run build        # Build TypeScript
npm run dev          # Watch mode
npm run test         # Run Vitest tests
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

### Server Package (`packages/server/`)
```bash
cd packages/server
npm run dev          # Start with hot reload (tsx)
npm run build        # Build TypeScript
npm run start        # Start production server
npm run db:seed      # Seed Neo4j database with test data
# Neo4j Browser available at http://localhost:7474
```

### Web Package (`packages/web/`)
```bash
cd packages/web
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run Vitest tests
```