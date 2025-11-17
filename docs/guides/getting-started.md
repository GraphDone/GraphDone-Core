# Getting Started with GraphDone

Welcome to GraphDone! This guide will help you set up and start using GraphDone for your team's project management needs.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
- **npm 9+** - Comes with Node.js
- **Docker & Docker Compose** - [Get Docker](https://docs.docker.com/get-docker/)
- **Git** - [Install Git](https://git-scm.com/downloads)

## Installation

### Option 1: Quick Setup Script

```bash
# Clone the repository
git clone https://github.com/GraphDone/GraphDone-Core.git
cd GraphDone-Core

# One command setup (recommended)
./start

# OR run setup script directly
./tools/setup.sh
```

The setup script will:
- Install all dependencies
- Set up environment variables
- Start the database
- Run initial migrations
- Build the packages

### Option 2: Manual Setup

```bash
# Clone and install dependencies
git clone https://github.com/GraphDone/GraphDone-Core.git
cd GraphDone-Core
npm install

# Set up environment variables (optional - start script handles this)
cp packages/server/.env.example packages/server/.env
cp packages/web/.env.example packages/web/.env

# Start database (handled automatically by ./start)
cd deployment && docker-compose up -d neo4j

# Database seeding handled automatically by the application

# Build packages
npm run build
```

## First Run

Start the development servers:

```bash
# Recommended approach
./start

# OR start servers directly
./tools/run.sh
```

This will start:
- **Web application** at http://localhost:3127
- **GraphQL API** at http://localhost:4127/graphql
- **Neo4j database** at localhost:7687
- **Neo4j Browser** at http://localhost:7474

## Core Concepts

### Work Items
Work items represent elements in your graph. GraphDone supports 9 core types:
- **DEFAULT** - Generic work item
- **EPIC** - Large initiative spanning multiple deliverables
- **MILESTONE** - Key project checkpoint
- **OUTCOME** - Expected result or deliverable
- **FEATURE** - New functionality or capability
- **TASK** - Specific work item to be completed
- **BUG** - Software defect requiring resolution
- **IDEA** - Concept or proposal for future development
- **RESEARCH** - Investigation or analysis work

### Priority System
GraphDone uses a multi-dimensional priority system:
- **Executive Priority** - Strategic importance set by leadership
- **Individual Priority** - Personal importance to contributors
- **Community Priority** - Collective validation through rating
- **Computed Priority** - Weighted combination determining position

### Spherical Model
Work is visualized in a 3D sphere where:
- **Center** - Highest priority items with full resources
- **Inner Spheres** - Important work with substantial support
- **Outer Spheres** - Experimental projects with idle resources
- **Periphery** - New ideas with minimal but real support

## Creating Your First Work Item

1. Open the web application at http://localhost:3127
2. Login with the demo credentials (admin/graphdone)
3. Click "Create Work Item" button or use the "+" in the graph area
4. Fill in the details:
   - **Title**: Brief, descriptive name
   - **Type**: Choose from 9 available work item types
   - **Description**: Detailed explanation
   - **Priority**: Set executive and individual priority (0-1)
5. Click "Create Work Item"

Your work item will appear in the graph visualization, positioned based on its computed priority.

## Basic Workflow

1. **Create Outcomes** - Define what you want to achieve
2. **Break Down into Tasks** - Create specific, actionable items
3. **Set Dependencies** - Connect related work items
4. **Assign Contributors** - Add team members to work items
5. **Democratic Prioritization** - Let the community validate and boost ideas
6. **Track Progress** - Update status as work progresses

## Next Steps

- [Explore the Architecture](./architecture-overview.md)
- [Learn about AI Agent Integration](./ai-agents-integration.md)
- [Complete Graph Creation Guide](../features/graph-creation.md)
- [Admin System Documentation](../features/admin-system.md)
- [Set up Production Deployment](../deployment/README.md)
- [Join the Community Discussions](https://github.com/GraphDone/GraphDone-Core/discussions)

## Common Issues

### Database Connection Errors
Ensure Neo4j is running:
```bash
# From project root
./start

# OR manually start database
cd deployment && docker-compose up -d neo4j
```

### Port Already in Use
Change the ports in your `.env` files if 3127 or 4127 are occupied.

### Node Version Issues
GraphDone requires Node.js 18+. Check your version:
```bash
node --version
```

## Support

If you encounter issues:
1. Check the health endpoint: http://localhost:4127/health
2. Review the [Testing Guide](../../tests/README.md) for common solutions
3. Search [existing issues](https://github.com/GraphDone/GraphDone-Core/issues)
4. Create a new issue with detailed information

Welcome to the future of collaborative work! 🚀