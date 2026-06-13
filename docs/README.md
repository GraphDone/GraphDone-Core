# GraphDone Documentation

Welcome to the GraphDone documentation! This directory contains comprehensive guides, API references, and deployment information for working with GraphDone.

## 📚 Documentation Structure

### [API Reference](./api/)
- GraphQL schema and resolvers
- REST endpoints
- WebSocket subscriptions
- Authentication and authorization

### 🌊 Living Graph Era (start here for current development)
- [User Stories — the backlog that drives development](./USER_STORIES.md) - **Every feature starts here; every story maps to tests**
- [Systems Reference](./SYSTEMS.md) - **What's shipped and where it lives** — every subsystem mapped to its code, tests, and story
- [Interaction Model — the friction-free contract](./design/interaction-model.md) - UX constitution: modes, exits, click budgets
- [Progressive Streaming design](./design/progressive-streaming.md) - ADAPT-4: scale to huge graphs on slow links
- [Testing & Refinement Plan](./TESTING_AND_REFINEMENT_PLAN.md) - The never-done loop; current cycle's verification debt
- [AI Agents Quickstart](./api/AI_AGENTS.md) - 5-minute MCP/GraphQL setup for agent teammates

### [Developer Guides](./guides/)
- [Getting Started](./guides/getting-started.md) - Setup and first steps
- [Architecture Overview](./guides/architecture-overview.md) - System design and technical decisions
- [Testing Guide](../tests/README.md) - **E2E testing with robust authentication system**
- [SQLite Deployment Modes](./guides/sqlite-deployment-modes.md) - Local dev vs Docker authentication storage
- [User Flows](./guides/user-flows.md) - How teams actually use GraphDone

### 🤖 AI Agents Documentation
> **Start here**: [Simple AI Agent Reality Check](./simple-agent-reality.md) - **What we're actually building**

**Implementation Guides**:
- [Simple AI Agent Reality Check](./simple-agent-reality.md) - 🎯 **THE PLAN**: Smart chia pet with Ollama
- [AI Agents Technical Spec](./ai-agents-tech-spec.md) - 📚 Complete technical implementation (advanced)
- [Agent Planning Scenarios](./agent-planning-scenarios.md) - 🎪 Interactive planning examples (future)

### 🔒 Security & Production
> **CRITICAL FOR RELEASE**: [TLS Implementation Plan](./security/tls-implementation-plan.md) - **Required before production**

**Security Documentation**:
- [TLS Implementation Plan](./security/tls-implementation-plan.md) - 🚨 **MUST READ**: HTTPS, SSL certificates, secrets management
- [Production Security Checklist](./security/tls-implementation-plan.md#deployment-security-checklist) - Pre-launch security validation

### [Deployment](./deployment/)
- Docker setup
- Kubernetes manifests  
- Cloud provider guides
- Production considerations (see Security section above for TLS)

## 🚀 Quick Start

1. **Setup Development Environment**
   ```bash
   ./tools/setup.sh
   ```

2. **Start Development Servers**
   ```bash
   ./tools/run.sh
   ```

3. **Run Tests**
   ```bash
   ./tools/test.sh
   ```

4. **Build for Production**
   ```bash
   ./tools/build.sh --production
   ```

## 📖 Key Concepts

- **Graph-native collaboration** - Work flows through natural dependencies
- **Spherical priority model** - Ideas migrate from periphery to center
- **Democratic prioritization** - Community validation guides resource allocation
- **Human-AI coordination** - Smart chia pets that help with planning (see AI docs above)

## 🔗 Quick Links

- [Project Philosophy](./philosophy.md)
- [API Documentation](./api/graphql.md)
- [Deployment Guide](./deployment/README.md)

## 📞 Support

- [GitHub Issues](https://github.com/GraphDone/GraphDone-Core/issues)
- [Discussions](https://github.com/GraphDone/GraphDone-Core/discussions)

---

*For teams who think differently* 🌐