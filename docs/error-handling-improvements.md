# Error Handling Improvements

## Overview

GraphDone now has comprehensive error handling for Docker-related issues, preventing users from being "left hanging" with cryptic error messages.

## What Changed

### 1. Enhanced Error Detection

**Before:**
```
KeyError: 'ContainerConfig'
File "/usr/lib/python3/dist-packages/compose/service.py", line 330
[Script exits with no guidance]
```

**After:**
```
╔════════════════════════════════════════════════════════════════╗
║                    ❌ Docker Error Detected ❌                  ║
╚════════════════════════════════════════════════════════════════╝

🔍 Issue: Corrupted container state detected

This happens when Docker containers are in an inconsistent state.

Quick Fix (Recommended):
  ./start stop    # Stop all services
  ./start         # Start fresh

If that doesn't work, try a complete cleanup:
  ./start remove  # Remove all containers and data
  ./start setup   # Fresh installation

Error Details:
[Detailed error output for debugging]
```

### 2. Smart Error Recognition

The error handler now recognizes and provides specific guidance for:

1. **ContainerConfig errors** - Corrupted container state
2. **Network errors** - Docker network issues
3. **Permission errors** - Docker permission problems
4. **Port conflicts** - Services using GraphDone's ports
5. **Disk space issues** - Not enough storage
6. **Timeout errors** - Slow Docker operations
7. **Docker not running** - Docker daemon not started
8. **Unknown errors** - General fallback with helpful steps

### 3. Improved Scripts

#### `start` Script
- Removed `set -e` to allow graceful error handling
- Added `handle_docker_error()` function with smart error detection
- Added `safe_docker()` wrapper for Docker commands
- Enhanced `cmd_stop()` with better error handling

#### `tools/run.sh` Script
- Removed `set -e` to allow graceful error handling
- Added `handle_docker_error()` function
- Wrapped critical docker-compose commands with error detection
- Added error log capture to /tmp for analysis

### 4. New Documentation

Created comprehensive troubleshooting guide:
- `docs/troubleshooting-docker.md` - Complete Docker error reference
- `docs/error-handling-improvements.md` - This document

## Error Handling Flow

```
User runs: ./start
    ↓
Docker command executes
    ↓
Error occurs?
    ↓
Error output captured
    ↓
Error pattern matched
    ↓
Specific guidance provided
    ↓
User follows clear steps
    ↓
Issue resolved ✅
```

## Testing

Tested with actual ContainerConfig error:
```bash
# Error occurred naturally during development
docker-compose up --build
# ERROR: 'ContainerConfig'

# Error handler provided clear guidance
./start stop    # Fixed the issue
./start         # System recovered successfully
```

## Benefits

1. **No more hanging** - Users always get actionable guidance
2. **Faster resolution** - Specific fixes for each error type
3. **Better UX** - Clear, formatted, helpful error messages
4. **Self-service** - Users can fix most issues without external help
5. **Reduced frustration** - No more cryptic Python stack traces

## Error Categories Handled

| Error Type | Detection | Solution Provided |
|------------|-----------|-------------------|
| ContainerConfig | `ContainerConfig`, `container.*config` | Stop → Start or Remove → Setup |
| Network | `network.*not found`, `network.*error` | Stop → Prune networks → Start |
| Permissions | `permission denied`, `cannot connect` | Run setup_docker.sh |
| Port Conflict | `port.*allocated`, `address.*in use` | Stop services, kill port |
| Disk Space | `no space left`, `disk.*full` | Run docker system prune |
| Timeout | `timeout`, `timed out` | Restart Docker Desktop, wait |
| Docker Down | `Cannot connect.*daemon` | Start Docker Desktop |
| Unknown | All others | General troubleshooting steps |

## Common Resolution Paths

**90% of errors:**
```bash
./start stop
./start
```

**Stubborn errors:**
```bash
./start remove
./start setup
```

**Complete reset:**
```bash
./start stop
docker system prune -a
./start setup
```

## Future Enhancements

Potential improvements for future versions:

1. **Automatic recovery** - Try common fixes automatically before showing error
2. **Error telemetry** - Collect anonymized error patterns to improve detection
3. **Interactive fixing** - Offer to run fix commands for the user
4. **Health checks** - Pre-flight checks before operations
5. **Rollback support** - Automatic rollback on failed operations

## For Developers

### Adding New Error Detection

To add detection for a new error pattern:

1. Update `handle_docker_error()` in both `start` and `tools/run.sh`
2. Add a new `elif` clause with the error pattern
3. Provide clear issue description and solution steps
4. Update `docs/troubleshooting-docker.md`
5. Test with actual error condition

Example:
```bash
elif echo "$error_output" | grep -qi "new.*pattern"; then
    log_warning "🔍 Issue: Description of the problem"
    echo ""
    log_info "${BOLD}Solution:${NC}"
    echo "  ${GREEN}./start fix-command${NC}"
    echo ""
```

### Testing Error Handlers

To test error handling without breaking the system:

```bash
# Source the script to test functions
source start

# Call error handler with test input
handle_docker_error "KeyError: 'ContainerConfig'" "test"

# Verify output is helpful and actionable
```

## Related Documentation

- [docs/troubleshooting-docker.md](./troubleshooting-docker.md) - Complete troubleshooting guide
- [README.md](../README.md) - Main project documentation
- [docs/tls-ssl-setup.md](./tls-ssl-setup.md) - TLS/SSL configuration

## Support

If you encounter an error not covered by the error handler:

1. Check [docs/troubleshooting-docker.md](./troubleshooting-docker.md)
2. Report issue at: https://github.com/anthropics/graphdone/issues
3. Include the full error output for analysis
