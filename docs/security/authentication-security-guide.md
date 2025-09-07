# GraphDone Authentication Security Guide

## Overview

GraphDone uses a hybrid authentication system with SQLite for user credentials and Neo4j for graph data. This guide documents security practices, identifies vulnerabilities, and provides implementation roadmap.

## Current Security Implementation

### ✅ Secure Practices in Place

#### Password Storage
- **Bcrypt hashing**: 10 rounds (industry standard)
- **Hash protection**: Password hashes never exposed via API
- **Secure validation**: Timing-attack resistant `bcrypt.compare()`
- **File location**: `packages/server/src/auth/sqlite-auth.ts:88`

```typescript
// Secure password hashing
const passwordHash = await bcrypt.hash(userData.password, 10);

// Secure validation
return bcrypt.compare(password, user.passwordHash);

// Hash protection in all API responses
passwordHash: undefined // Never expose password hash
```

#### Password Requirements (Frontend Only)
- **Minimum length**: 8 characters enforced in signup
- **Strength meter**: Visual feedback for password complexity
- **Confirmation**: Password matching validation
- **Location**: `packages/web/src/pages/Signup.tsx:58`

#### Database Security
- **SQLite file**: Local file-based storage
- **Permissions**: Documented recommendations (600 for database file)
- **Location**: `data/auth.db` (development), Docker volume (production)

## ❌ Critical Security Gaps

### 1. No Rate Limiting or Brute Force Protection
**Status**: ⚠️ HIGH RISK
- No login attempt throttling
- No account lockout mechanisms
- No IP-based rate limiting
- Vulnerable to credential stuffing attacks

### 2. Client-Side Only Validation
**Status**: ⚠️ MEDIUM RISK
- Password requirements only enforced in frontend
- Backend accepts any password length/complexity
- API bypass allows weak passwords

### 3. Default Development Credentials
**Status**: ⚠️ HIGH RISK (Production)
```typescript
// Hardcoded in packages/server/src/index.ts:123
admin:graphdone (ADMIN role)
viewer:graphdone (VIEWER role)
```

### 4. No Login Security Transparency
**Status**: ⚠️ LOW RISK (UX Issue)
- Users unaware of security practices
- No visibility into password storage methods
- Missing security confidence indicators

## Implementation Roadmap

### Phase 1: Critical Security (Immediate)

#### A. Rate Limiting Implementation
```typescript
// packages/server/src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 attempts per IP
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const accountLockout = {
  maxAttempts: 5,
  lockoutTime: 30 * 60 * 1000, // 30 minutes
  resetTime: 24 * 60 * 60 * 1000 // 24 hours
};
```

#### B. Backend Password Validation
```typescript
// packages/server/src/utils/password-validation.ts
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export function validatePassword(password: string, requirements: PasswordRequirements): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters`);
  }
  
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // ... additional validations
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

#### C. Login Security Transparency Dialog
```typescript
// packages/web/src/components/LoginSecurityDialog.tsx
export function LoginSecurityDialog({ isOpen, onClose }: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>🔒 How We Protect Your Account</DialogTitle>
      <DialogContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-green-600">✓ Password Security</h3>
            <p className="text-sm text-gray-600">
              Passwords are hashed using bcrypt with 10 rounds before storage. 
              We never store or transmit your actual password.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-600">✓ Secure Storage</h3>
            <p className="text-sm text-gray-600">
              Authentication data is stored in encrypted SQLite database with 
              restricted file permissions.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-orange-600">⚠ Login Attempts</h3>
            <p className="text-sm text-gray-600">
              Currently implementing: Rate limiting and account lockout protection.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Phase 2: Enhanced Security (Short-term)

#### A. Failed Login Tracking
```sql
-- SQLite schema addition
CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_attempts (user_id, attempted_at),
    INDEX idx_ip_attempts (ip_address, attempted_at)
);
```

#### B. Account Security Settings
```typescript
// Addition to packages/web/src/pages/Settings.tsx
<div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
  <h2 className="text-lg font-semibold text-gray-100 mb-4">Account Security</h2>
  <div className="space-y-4">
    <button className="btn btn-secondary">Change Password</button>
    <button className="btn btn-secondary">View Login History</button>
    <button className="btn btn-danger">Revoke All Sessions</button>
  </div>
</div>
```

### Phase 3: Advanced Security (Medium-term)

#### A. SQLite Encryption at Rest
```bash
# SQLCipher implementation option
npm install @journeyapps/sqlcipher

# Environment variable
SQLITE_ENCRYPTION_KEY=your-32-byte-encryption-key
```

#### B. Session Management
- JWT token rotation
- Device/session tracking
- Concurrent session limits

#### C. Audit Logging
- Authentication events
- Permission changes
- Data access patterns

## Docker Volume Security

### Current Docker Configuration
```yaml
# deployment/docker-compose.yml
volumes:
  - sqlite_auth_data:/app/data  # ✅ Persistent storage
```

### Security Recommendations

#### File System Permissions
```bash
# Container initialization
docker exec -it graphdone-api-prod chown app:app /app/data/auth.db
docker exec -it graphdone-api-prod chmod 600 /app/data/auth.db
```

#### Volume Encryption
```yaml
# Advanced: Docker volume encryption
volumes:
  sqlite_auth_data:
    driver_opts:
      type: tmpfs
      device: tmpfs
      o: "size=100m,uid=1000,gid=1000,mode=0600"
```

#### Backup Security
```bash
# Encrypted backup
docker run --rm -v sqlite_auth_data:/source alpine \
  tar czf - -C /source . | \
  gpg --symmetric --cipher-algo AES256 > auth-backup-$(date +%Y%m%d).tar.gz.gpg
```

## SQLite Encryption at Rest Options

### Option 1: SQLCipher (Recommended)
```typescript
// packages/server/src/auth/sqlite-auth.ts
import Database from '@journeyapps/sqlcipher';

const db = new Database(dbPath);
db.pragma('cipher_compatibility = 4');
db.pragma(`key = '${process.env.SQLITE_ENCRYPTION_KEY}'`);
```

**Pros**: Industry standard, transparent encryption
**Cons**: Additional dependency, slight performance impact

### Option 2: File System Encryption
```bash
# LUKS encrypted partition (Linux)
cryptsetup luksFormat /dev/sdb1
cryptsetup open /dev/sdb1 encrypted-sqlite
mount /dev/mapper/encrypted-sqlite /var/lib/docker/volumes/sqlite_auth_data/_data
```

**Pros**: OS-level encryption, no application changes
**Cons**: Complex setup, OS-dependent

### Option 3: Docker Secrets (Production)
```yaml
secrets:
  sqlite_encryption_key:
    external: true

services:
  graphdone-api:
    secrets:
      - sqlite_encryption_key
    environment:
      - SQLITE_ENCRYPTION_KEY_FILE=/run/secrets/sqlite_encryption_key
```

## Implementation Checklist

### Immediate (Critical Security)
- [ ] Implement rate limiting middleware
- [ ] Add backend password validation
- [ ] Force change of default passwords
- [ ] Add login security transparency dialog
- [ ] Document Docker volume permissions

### Short-term (Enhanced Security)  
- [ ] Failed login attempt tracking
- [ ] Account lockout mechanisms
- [ ] Login history in settings
- [ ] Session management improvements
- [ ] Basic audit logging

### Medium-term (Advanced Security)
- [ ] SQLite encryption at rest
- [ ] Advanced session controls
- [ ] Comprehensive audit trail
- [ ] Security monitoring alerts
- [ ] Penetration testing

## Security Monitoring

### Metrics to Track
- Failed login attempts per IP/user
- Password change frequency
- Session duration patterns  
- API endpoint access patterns
- Database file access patterns

### Alert Thresholds
- \>5 failed logins in 15 minutes (same IP)
- \>10 failed logins in 1 hour (same user)
- Database file permission changes
- Unusual API access patterns

## Compliance Considerations

### Data Protection
- GDPR compliance for EU users
- Password data retention policies
- Right to deletion implementation
- Data breach notification procedures

### Security Standards
- OWASP Top 10 compliance
- Regular security assessments
- Dependency vulnerability scanning
- Security configuration reviews

---

## Quick Reference

**Check Current Security Status**:
```bash
# Password requirements
grep -n "password.*length" packages/web/src/pages/Signup.tsx

# Rate limiting status  
grep -r "rate.*limit" packages/server/src/

# Default credentials
grep -A5 -B5 "graphdone" packages/server/src/index.ts
```

**Emergency Security Actions**:
```bash
# Change default passwords immediately
docker exec -it graphdone-api-prod npm run change-default-passwords

# Enable emergency rate limiting
docker exec -it graphdone-api-prod npm run enable-rate-limiting

# Backup authentication database
docker run --rm -v sqlite_auth_data:/source -v $(pwd):/backup alpine \
  tar czf /backup/auth-emergency-backup.tar.gz -C /source .
```