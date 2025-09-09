# Version Management

GraphDone uses a centralized version management system with the root `package.json` as the single source of truth.

## Current Version Strategy

- **Single Source of Truth**: Root `package.json` contains the authoritative version
- **Automatic Propagation**: Other components import from root package or centralized utilities
- **Consistent Updates**: Use the automated script to update all version references

## Version Update Process

### Simple Update Process
```bash
# 1. Run the simple update script
./scripts/update-version-simple.sh 0.3.2-alpha

# 2. Regenerate lockfile
npm install

# 3. Commit changes
git add .
git commit -m "Update version to v0.3.2-alpha"
git push
```

### What Gets Updated
The script only updates files that **cannot** import from package.json:
- All package.json files in the monorepo
- Docker image tags in compose files
- Environment variable defaults
- Documentation references

## Version References

### Package.json Files
- `package.json` (root - source of truth)
- `packages/core/package.json`
- `packages/server/package.json`
- `packages/web/package.json`
- `packages/mcp-server/package.json`

### Docker Images
- `deployment/docker-compose.yml`
- `deployment/docker-compose.http.yml`

### Application Code
- `packages/web/src/utils/version.ts` (imports from root package.json)
- `packages/mcp-server/src/index.ts` (uses centralized version.ts)
- `packages/mcp-server/src/health-server.ts` (uses centralized version.ts)

### Configuration Files
- `packages/web/.env.example`
- `CLAUDE.md`

## Future Improvements

1. **Automatic Sync**: Consider using a tool like Lerna or Rush for automatic version syncing
2. **CI/CD Integration**: Automate version updates in CI/CD pipeline
3. **Semantic Versioning**: Implement automated semantic version bumping
4. **Release Notes**: Generate release notes from commit history

## Development Guidelines

- **Never hardcode versions** in application code
- **Always import** from centralized version utilities
- **Use the update script** for consistent version updates
- **Test after version updates** to ensure all references work correctly