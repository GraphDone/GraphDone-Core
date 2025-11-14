# GraphDone Multipass VM Testing - Performance Optimization

This document outlines strategies to speed up E2E testing with Multipass VMs.

## Current Performance Bottlenecks

**Full VM Setup Time: ~10-15 minutes**
- VM Launch: 30s
- Cloud-init provisioning: 1-2min
- Node.js installation: 1min
- GraphDone clone: 30s
- npm install: 5-8min (largest bottleneck!)
- Playwright browsers: 2-3min
- Database seeding: 30s

## Optimization Strategies

### 1. VM Image Caching (Fastest - Recommended)

**Concept:** Pre-build base VMs with all dependencies, clone for testing

**Benefits:**
- Reduces setup time from 15min → 2min
- Consistent test environment
- Parallel test execution possible

**Implementation:**
```bash
# Create base images for common branches
./tools/create-base-image.sh main
./tools/create-base-image.sh develop  
./tools/create-base-image.sh vm_multi-pass

# Use cached image for testing
./tools/test-vm-e2e.sh main --use-cache
```

**Cache Invalidation:**
- Update base images nightly via cron
- Rebuild on package.json changes
- Tag images with dependency hash

### 2. Layered Caching Strategy

**Layer 1: Base OS + System Dependencies** (rarely changes)
- Ubuntu 22.04
- Docker, Node.js, build-essential
- Playwright browsers + system deps
- **Cache duration:** Weeks/months

**Layer 2: GraphDone Dependencies** (changes weekly)
- node_modules from package.json
- Playwright browsers
- Docker images (Neo4j, Redis)
- **Cache duration:** 1 week or until package.json changes

**Layer 3: Source Code** (changes frequently)
- Git clone + checkout specific branch
- Build artifacts
- **Cache duration:** Per test run

### 3. Parallel Testing Architecture

```
┌─────────────────┐
│  Base Image     │
│  (cached)       │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
  Test VM1  Test VM2  Test VM3  Test VM4
  (main)    (develop) (PR-123)  (PR-124)
```

Run multiple test VMs in parallel from the same base image.

### 4. Docker Layer Caching

Pre-pull and cache Docker images in the base VM:
```bash
# In base image creation
docker pull neo4j:5.15-community
docker pull redis:7-alpine
```

### 5. npm Dependency Caching

**Option A: Local npm cache**
```bash
# Mount host npm cache into VM
multipass mount ~/.npm graphdone-vm:/home/ubuntu/.npm
```

**Option B: Verdaccio local npm registry**
- Run local npm proxy
- Cache all packages locally
- Reduces npm install from 8min → 1min

### 6. Incremental Updates

Instead of full rebuild, only update what changed:
```bash
# In cached VM
cd ~/graphdone
git fetch origin
git checkout $BRANCH
git pull
npm install  # Only installs new deps
npm run build
```

## Implementation Priority

1. **Phase 1: Basic Caching** (implement first)
   - Create base image script ✅
   - Add `--use-cache` flag to test script
   - Auto-rebuild base images nightly

2. **Phase 2: Smart Invalidation**
   - Hash package.json for cache keys
   - Detect dependency changes
   - Partial updates when possible

3. **Phase 3: Parallel Testing**
   - Clone VMs from base image
   - Run multiple branches simultaneously
   - Aggregate test results

4. **Phase 4: Advanced Caching**
   - Local npm registry (Verdaccio)
   - Docker image pre-caching
   - Build artifact caching

## Expected Performance Gains

| Strategy | Time Saved | Complexity | Priority |
|----------|-----------|------------|----------|
| VM Image Caching | 10-13min | Low | High |
| npm Cache | 5-7min | Medium | High |
| Docker Pre-pull | 1-2min | Low | Medium |
| Parallel Tests | N/A (throughput) | High | Low |
| Local npm Registry | 6-7min | High | Low |

**Target:** Reduce E2E test time from ~15min to **2-3min** with basic caching.

## Maintenance

**Daily:**
- Check base image health
- Clean up old test VMs

**Weekly:**
- Rebuild base images for active branches
- Update Playwright browsers
- Clean npm/Docker caches

**On package.json change:**
- Trigger base image rebuild
- Invalidate relevant caches

## Monitoring

Track metrics:
- VM launch time
- npm install duration
- Total test time
- Cache hit rate
- Storage usage

Store in test reports for trend analysis.
