# CPU Throttling Configuration Guide

The MCP server includes CPU exhaustion protection to prevent resource abuse attacks. This guide explains how to configure CPU throttling for different environments.

## Environment Modes

### 1. 🚫 CI/CD Environments (Automatic)
**CPU throttling: DISABLED**

Automatically detected environments:
- `CI=true` 
- `GITHUB_ACTIONS=true`
- `DISABLE_CPU_THROTTLING=true`

**Why disabled**: CI environments have unpredictable CPU spikes from parallel test execution that would trigger false positives.

### 2. 🧪 Local Development Testing (Automatic)
**CPU throttling: RELAXED**

Automatically detected when:
- `NODE_ENV=test`
- `VITEST=true`
- Running with vitest/test commands

**Thresholds**:
- Max CPU: 95% (vs 80% production)
- Max operations: 5000/sec (vs 1000 production)
- Heavy operation threshold: 500ms (vs 100ms production)

### 3. 🔒 Production Test Servers (Manual)
**CPU throttling: FULL PROTECTION**

To enable CPU throttling on your own test servers:

```bash
# Enable production-level CPU throttling during tests
export ENABLE_CPU_THROTTLING_IN_TESTS=true

# Run your tests - CPU protection will be active
npm run test
```

**Use this when**:
- Testing CPU exhaustion protection features
- Validating security under load on your own infrastructure  
- Running chaos tests that should trigger CPU protection

### 4. 🏭 Production Servers (Default)
**CPU throttling: ENABLED**

**Thresholds**:
- Max CPU: 80%
- Max operations: 1000/sec
- Heavy operation threshold: 100ms
- Automatic throttling and cooldowns

## Manual Override

To completely disable CPU throttling in any environment:
```bash
export DISABLE_CPU_THROTTLING=true
```

To force enable in any environment:
```bash  
export ENABLE_CPU_THROTTLING_IN_TESTS=true
```

## Testing Your Configuration

The CPU monitor logs its mode on startup:

```
🚫 CPU Monitor: DISABLED for CI environment - no throttling
🧪 CPU Monitor: Test mode enabled - relaxed throttling  
🔒 CPU Monitor: Production test server mode - CPU throttling ENABLED
🏭 CPU Monitor: Production mode enabled - strict throttling
```

## Security Note

CPU throttling is a critical security feature that prevents:
- Resource exhaustion attacks
- CPU-intensive computation abuse  
- Service degradation from malicious inputs

Only disable it when necessary for testing, and always re-enable for production deployments.