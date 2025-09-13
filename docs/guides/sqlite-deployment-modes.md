# SQLite Authentication: Local Dev vs Docker Deployment

> **Key Insight**: SQLite runs as a local file-based database in both modes, but storage location and persistence differ significantly.

## Architecture Overview

SQLite serves as GraphDone's authentication database, storing:
- User accounts (login, passwords, roles)
- User settings and preferences  
- Team memberships
- Application configuration
- Server settings

**Unlike Neo4j (network database), SQLite is always a local file with no network latency.**

## Local Development Mode

### **File Location**
```bash
# SQLite database location (from sqlite-auth.ts:35)
./data/auth.db  (in project root)
```

### **How It Works**
```javascript
// packages/server/src/auth/sqlite-auth.ts:35
const dbPath = path.join(process.cwd(), 'data', 'auth.db');
```

**Local Dev Characteristics:**
- ✅ **Direct file access** on your local filesystem
- ✅ **Immediate persistence** - survives server restarts
- ✅ **Easy inspection** with SQLite GUI tools
- ✅ **Fast development** - no container overhead
- ✅ **Data survives** `npm run dev` restarts
- ⚠️ **Not portable** - tied to your specific machine
- ⚠️ **Not suitable** for team sharing

### **Database Creation**
```bash
# When you first run the server locally
npm run dev

# SQLite automatically creates:
mkdir -p data/              # Creates directory if needed
touch data/auth.db          # Creates empty database file
# Runs schema initialization (tables, default users)

# Output you'll see:
✅ Connected to SQLite auth database: /path/to/GraphDone-Core/data/auth.db
✅ Default users created:
   👤 admin / graphdone (ADMIN)  
   👁️  viewer / viewer123 (VIEWER)
```

### **Local Database Management**
```bash
# Inspect database directly
sqlite3 data/auth.db
.tables                    # Show all tables
SELECT * FROM users;       # See all users
.exit

# Reset database (for testing)
rm data/auth.db            # Delete database file
npm run dev                # Recreates with defaults

# Backup database
cp data/auth.db data/auth-backup.db
```

## Docker Deployment Mode

### **Current Issue: No Volume Persistence** ❌
```yaml
# deployment/docker-compose.yml - MISSING SQLite volume!
graphdone-api:
  volumes:
    - ../packages/server/.env:/app/.env
    - logs:/app/logs
    # ❌ Missing: SQLite database volume!
```

### **What Happens Now** (Problematic)
```bash
# Inside Docker container
/app/data/auth.db          # Created inside container filesystem

# Problem: Data is lost when container is recreated!
docker-compose down && docker-compose up
# ❌ All users, settings, and auth data disappears
# ❌ Default admin/viewer users recreated from scratch
```

### **Correct Docker Configuration** ✅
```yaml
# deployment/docker-compose.yml - FIXED
services:
  graphdone-api:
    container_name: graphdone-api-prod
    build:
      context: ..
      dockerfile: packages/server/Dockerfile
    environment:
      - NODE_ENV=production
      - NEO4J_URI=bolt://graphdone-neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=graphdone_password
      - PORT=4127
      - CORS_ORIGIN=http://localhost:3127
    ports:
      - "4127:4127"
    volumes:
      - ../packages/server/.env:/app/.env
      - logs:/app/logs
      # ✅ ADD: SQLite database persistence
      - sqlite_auth_data:/app/data
    depends_on:
      graphdone-neo4j:
        condition: service_healthy
      graphdone-redis:
        condition: service_healthy

volumes:
  neo4j_data:
  redis_data:  
  logs:
  # ✅ ADD: SQLite volume for persistent auth data
  sqlite_auth_data:
```

## Key Differences Summary

| Aspect | Local Development | Docker (Current) | Docker (Fixed) |
|--------|------------------|------------------|----------------|
| **Database Location** | `./data/auth.db` | `/app/data/auth.db` | `/app/data/auth.db` |
| **Persistence** | ✅ Survives restarts | ❌ Lost on container recreation | ✅ Survives container recreation |
| **Performance** | ✅ Direct filesystem | ✅ Container filesystem | ✅ Container filesystem |
| **Data Portability** | ❌ Machine-specific | ❌ Lost on redeploy | ✅ Docker volume backup |
| **Team Sharing** | ❌ Not shared | ❌ Reset per developer | ✅ Shared via volume |
| **Backup Strategy** | Copy file | ❌ None | Docker volume backup |

## Environment Variables

### **SQLite Configuration Options**
```bash
# Optional environment variables for SQLite behavior
SQLITE_AUTH_DB=/custom/path/auth.db    # Override database location
SQLITE_TIMEOUT=5000                    # Connection timeout (ms)
SQLITE_CACHE_SIZE=2000                 # Memory cache size
SQLITE_JOURNAL_MODE=WAL                # Write-Ahead Logging
SQLITE_SYNCHRONOUS=NORMAL              # Synchronization mode
```

### **Production Environment Setup**
```bash
# .env.production
NODE_ENV=production

# Neo4j (graph data)
NEO4J_URI=bolt://graphdone-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=secure_neo4j_password

# SQLite (auth data)
SQLITE_AUTH_DB=/app/data/auth.db       # Standard Docker path
SQLITE_JOURNAL_MODE=WAL                # Better concurrency
SQLITE_SYNCHRONOUS=NORMAL              # Good performance/safety balance

# JWT Security
JWT_SECRET=your-256-bit-secret-key
JWT_EXPIRES_IN=24h
```

## Migration and Backup Strategies

### **Local Development Backup**
```bash
# Backup before major changes
cp data/auth.db data/auth.db.backup

# Restore if needed
cp data/auth.db.backup data/auth.db

# Export users for migration
sqlite3 data/auth.db ".dump users" > users-backup.sql
```

### **Docker Production Backup**
```bash
# Backup SQLite volume
docker run --rm -v sqlite_auth_data:/source -v $(pwd):/backup alpine \
  tar czf /backup/sqlite-auth-backup.tar.gz -C /source .

# Restore SQLite volume
docker run --rm -v sqlite_auth_data:/target -v $(pwd):/backup alpine \
  tar xzf /backup/sqlite-auth-backup.tar.gz -C /target

# Copy database out of Docker volume
docker run --rm -v sqlite_auth_data:/source -v $(pwd):/dest alpine \
  cp /source/auth.db /dest/auth.db

# Inspect database from Docker volume
docker run --rm -it -v sqlite_auth_data:/data alpine sh
# Inside container: sqlite3 /data/auth.db
```

### **Development to Production Migration**
```bash
# 1. Export from local development
sqlite3 data/auth.db ".dump" > auth-export.sql

# 2. Copy to production server
scp auth-export.sql server:/path/to/graphdone/

# 3. Import to Docker volume
docker run --rm -v sqlite_auth_data:/data -v $(pwd):/import alpine sh -c \
  "sqlite3 /data/auth.db < /import/auth-export.sql"

# 4. Restart GraphDone API
docker-compose restart graphdone-api
```

## Troubleshooting

### **Common Issues**

#### **"Database locked" errors**
```bash
# Check for multiple connections
lsof data/auth.db          # Local dev
docker exec -it graphdone-api-prod lsof /app/data/auth.db  # Docker

# Solution: Enable WAL mode
SQLITE_JOURNAL_MODE=WAL
```

#### **Users disappear after Docker restart**
```bash
# Diagnosis: Missing volume mount
docker volume ls           # Check if sqlite_auth_data exists
docker-compose logs graphdone-api | grep "Connected to SQLite"

# Solution: Add volume mount to docker-compose.yml
```

#### **Permission errors (Linux)**
```bash
# Fix file permissions
sudo chown -R $USER:$USER data/
chmod 700 data/            # Directory: owner read/write/execute
chmod 600 data/auth.db     # Database: owner read/write only
```

#### **Database corruption**
```bash
# Check integrity
sqlite3 data/auth.db "PRAGMA integrity_check;"

# Repair if possible
sqlite3 data/auth.db ".recover" | sqlite3 auth-recovered.db
mv auth-recovered.db data/auth.db
```

## Security Considerations

### **File Permissions**
```bash
# Secure permissions (both local and Docker)
chmod 700 data/           # Only owner can access directory
chmod 600 data/auth.db    # Only owner can read/write database

# Docker: Ensure container user owns the database
docker exec -it graphdone-api-prod chown app:app /app/data/auth.db
docker exec -it graphdone-api-prod chmod 600 /app/data/auth.db
```

### **Encryption at Rest**
```bash
# For sensitive deployments, consider SQLite encryption:
SQLITE_ENCRYPTION_KEY=your-32-byte-encryption-key

# Requires SQLite with encryption support (SQLCipher)
# Note: Not implemented in current GraphDone version
```

## Performance Characteristics

### **SQLite Performance Profile**
- **Reads**: ~100,000+ operations/second (authentication queries)
- **Writes**: ~50,000+ operations/second (user updates)
- **Database size**: <1MB for 1000 users
- **Memory usage**: ~2-5MB resident set
- **Startup time**: <10ms (database initialization)

### **Why SQLite for Auth vs Neo4j**
```bash
# Authentication query performance
SQLite: SELECT * FROM users WHERE username=?     # <1ms
Neo4j:  MATCH (u:User {username: $username})      # 5-50ms (network + query)

# Zero network latency
SQLite: Direct file I/O                           # 0ms network
Neo4j:  TCP connection to database                # 1-10ms network

# Availability
SQLite: Always available (file system)           # 99.999%
Neo4j:  Network dependency                        # 99.9% (network issues)
```

This explains why GraphDone uses SQLite for authentication (speed + availability) and Neo4j for graph operations (relationships + analytics).