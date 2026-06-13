# Docker Troubleshooting Guide

This guide helps you resolve common Docker errors when running GraphDone.

## Quick Fix for Most Issues

For most Docker errors, this sequence usually works:

```bash
./start stop     # Stop all services
./start          # Start fresh
```

If that doesn't work:

```bash
./start remove   # Complete cleanup (removes data!)
./start setup    # Fresh installation
```

## Common Docker Errors

### 1. ContainerConfig Error (KeyError: 'ContainerConfig')

**What it looks like:**
```
KeyError: 'ContainerConfig'
File "/usr/lib/python3/dist-packages/compose/service.py"
```

**What causes it:**
- Containers stopped improperly
- Partial image downloads
- Volume mount conflicts
- Corrupted container state

**Solution:**
```bash
# Quick fix (recommended)
./start stop
./start

# If that fails, complete cleanup
./start remove
./start setup
```

### 2. Port Already in Use

**What it looks like:**
```
Error: port is already allocated
Error: address already in use
```

**Solution:**
```bash
# Stop GraphDone
./start stop

# Kill specific port (example for port 3127)
lsof -ti:3127 | xargs kill -9

# Restart
./start
```

### 3. Docker Not Running

**What it looks like:**
```
Cannot connect to the Docker daemon
Error: docker is not running
```

**Solution:**
1. Start Docker Desktop
2. Wait 30+ seconds for Docker to fully initialize
3. Check Docker is running: `docker ps`
4. Run: `./start`

### 4. Permission Denied

**What it looks like:**
```
Got permission denied while trying to connect to the Docker daemon
```

**Solution:**
```bash
# Fix Docker permissions
./scripts/setup_docker.sh

# Restart terminal, then:
./start
```

### 5. Network Error

**What it looks like:**
```
network not found
network error
```

**Solution:**
```bash
./start stop
docker network prune  # Clean up networks
./start
```

### 6. Disk Space Issues

**What it looks like:**
```
no space left on device
disk is full
```

**Solution:**
```bash
# Clean up Docker resources
docker system prune -a

# Then restart GraphDone
./start
```

### 7. Timeout Errors

**What it looks like:**
```
timeout
operation timed out
```

**Causes:**
- Docker Desktop is slow to start
- First-time image downloads
- Heavy plugins loading (GDS + APOC)

**Solution:**
1. Restart Docker Desktop
2. Wait 30+ seconds
3. Try again: `./start`
4. On first run, Neo4j can take 2-5 minutes (downloading plugins)

## Diagnostic Commands

Check Docker status:
```bash
docker ps                     # List running containers
docker images                 # List Docker images
docker network ls             # List Docker networks
docker volume ls              # List Docker volumes
./start status               # Check GraphDone status
```

Check logs:
```bash
# View container logs
docker logs graphdone-neo4j
docker logs graphdone-api
docker logs graphdone-web

# View Docker Compose logs
docker compose -f deployment/docker-compose.yml logs
```

## Complete Reset

If all else fails, perform a complete reset:

```bash
# 1. Stop everything
./start stop

# 2. Remove all GraphDone containers and data
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker volume prune -f

# 3. Clean up networks
docker network prune -f

# 4. Remove GraphDone completely
./start remove

# 5. Fresh installation
./start setup

# 6. Start
./start
```

## Getting Help

If you're still having issues:

1. Check the error message carefully - the new error handler provides specific guidance
2. Look for the "🔍 Issue:" line in the error output
3. Follow the suggested commands exactly
4. Check Docker Desktop is running and healthy
5. Report the issue at: https://github.com/anthropics/graphdone/issues

## Prevention Tips

**Best Practices:**
- Always use `./start stop` before shutting down
- Don't manually kill Docker containers
- Keep Docker Desktop updated
- Give Docker Desktop enough resources (4GB+ RAM)
- On first run, be patient (2-5 minutes for Neo4j plugins)

**What NOT to do:**
- Don't use `docker kill` or `docker rm -f` directly
- Don't manually edit Docker volumes
- Don't interrupt Docker Compose during startup
- Don't run multiple instances of GraphDone simultaneously
