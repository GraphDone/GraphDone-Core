# Getting Started with GraphDone

**AI-Generated Content Warning: This documentation contains AI-generated content. Verify information before depending on it for decision making.**

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
git clone https://github.com/your-org/graphdone.git
cd graphdone

# Run setup script
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
git clone https://github.com/your-org/graphdone.git
cd graphdone
npm install

# Set up environment variables
cp packages/server/.env.example packages/server/.env
cp packages/web/.env.example packages/web/.env

# Start database
docker-compose up -d postgres redis

# Run database migrations
cd packages/server && npm run db:migrate && cd ../..

# Build packages
npm run build
```

## First Run

Start the development servers:

```bash
./tools/run.sh
```

This will start:
- **Web application** at http://localhost:3000
- **GraphQL API** at http://localhost:4000/graphql
- **PostgreSQL database** at localhost:5432

## Core Concepts

### Nodes
Nodes represent work items in your graph:
- **Outcomes** - High-level goals and results
- **Tasks** - Specific work to be done
- **Milestones** - Important checkpoints
- **Ideas** - Proposals and concepts

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

## Creating Your First Node

1. Open the web application at http://localhost:3000
2. Click "Add Node" in the Graph View
3. Fill in the details:
   - **Title**: Brief, descriptive name
   - **Type**: Choose appropriate node type
   - **Description**: Detailed explanation
   - **Priority**: Set initial priority values
4. Click "Create Node"

Your node will appear in the graph visualization, positioned based on its computed priority.

## Basic Workflow

1. **Create Outcomes** - Define what you want to achieve
2. **Break Down into Tasks** - Create specific, actionable items
3. **Set Dependencies** - Connect related work items
4. **Assign Contributors** - Add team members to nodes
5. **Democratic Prioritization** - Let the community validate and boost ideas
6. **Track Progress** - Update status as work progresses

## Next Steps

- [Explore the Architecture](./architecture.md)
- [Learn about AI Agent Integration](./ai-agents.md)
- [Set up Production Deployment](../deployment/README.md)
- [Join the Community Discussions](https://github.com/your-org/graphdone/discussions)

## Common Issues

### Database Connection Errors
Ensure PostgreSQL is running:
```bash
docker-compose up -d postgres
```

### Port Already in Use
Change the ports in your `.env` files if 3000 or 4000 are occupied.

### Node Version Issues
GraphDone requires Node.js 18+. Check your version:
```bash
node --version
```

## Support

If you encounter issues:
1. Check the [Troubleshooting Guide](./troubleshooting.md)
2. Search [existing issues](https://github.com/your-org/graphdone/issues)
3. Create a new issue with detailed information

Welcome to the future of collaborative work! 🚀