# GraphDone Admin System

GraphDone includes a comprehensive administrative interface for managing users, security, and system operations. Access requires `ADMIN` role privileges.

## Access

Navigate to `/admin` after logging in with an admin account. Only users with `ADMIN` role can access the administrative interface.

```
https://localhost:3127/admin  # Development
https://localhost:3128/admin  # Production (HTTPS)
```

## Admin Interface Overview

The admin panel is organized into five main sections:

### 🧑‍💼 User Management
- **User roles and permissions**
- **Account activation/deactivation**
- **Password resets**
- **User creation and deletion**
- **Role assignment (ADMIN, MEMBER, VIEWER)**

### ⚙️ Registration Settings
- **User registration policies**
- **Default role assignments**
- **Account approval workflows**
- **Registration restrictions**

### 🗄️ Database Management
- **Database configuration**
- **Connection status monitoring**
- **Maintenance operations**
- **Data integrity checks**

### 🔒 Security Management
- **Password policies**
- **Session management**
- **Security audit logs**
- **Authentication configuration**

### 💾 Backup & Restore
- **System backup creation**
- **Data export/import**
- **Restore operations**
- **Backup scheduling**

## User Management Features

### User Role System

GraphDone implements a hierarchical role system:

| Role | Permissions | Capabilities |
|------|-------------|--------------|
| **ADMIN** | Full system access | User management, system configuration, all graph operations |
| **MEMBER** | Standard user access | Create graphs, manage own content, collaborate |
| **VIEWER** | Read-only access | View graphs, limited interaction |
| **GUEST** | Temporary access | Basic viewing, no persistent changes |

### User Account Operations

**Create New User:**
1. Click "Add User" in User Management
2. Enter email, username, and name
3. Select initial role
4. System generates temporary password
5. User receives activation email

**Role Management:**
- Modify user roles through dropdown selection
- Role changes take effect immediately
- System logs all role modifications

**Account Status Control:**
- **Active**: Normal access to system
- **Inactive**: Account disabled, no login access
- **Deactivated**: Temporary suspension with date tracking

**Password Management:**
- Generate new temporary passwords
- Force password reset on next login
- View password change history

**Account Deletion:**
- Soft delete preserves data integrity
- Confirmation required with typed verification
- Associated graph data handled according to retention policy

## Security Features

### Authentication Security
- **JWT token management**
- **Session timeout configuration**
- **Multi-factor authentication support** (when configured)
- **Login attempt monitoring**

### Password Policies
- **Minimum complexity requirements**
- **Password history tracking**
- **Forced password rotation**
- **Secure password generation**

### Audit Logging
- **User action tracking**
- **Security event monitoring**
- **Login/logout history**
- **Administrative action logs**

## Database Administration

### Connection Management
- **Real-time connection status**
- **Neo4j database health monitoring**
- **Connection pool statistics**
- **Performance metrics**

### Maintenance Operations
- **Database cleanup routines**
- **Index optimization**
- **Orphaned data removal**
- **Performance tuning**

### Data Integrity
- **Consistency checks**
- **Relationship validation**
- **Data corruption detection**
- **Automated repair procedures**

## Backup & Recovery

### Backup Operations
- **Full system backups**
- **Incremental backups**
- **User data export**
- **Configuration backups**

### Restore Procedures
- **Point-in-time recovery**
- **Selective data restoration**
- **Configuration rollback**
- **Disaster recovery**

### Automated Scheduling
- **Recurring backup schedules**
- **Retention policy management**
- **Storage location configuration**
- **Backup verification**

## System Monitoring

### Health Dashboard
- **Service status indicators**
- **Performance metrics**
- **Error rate monitoring**
- **Resource utilization**

### Alert System
- **Critical error notifications**
- **Performance threshold alerts**
- **Security event warnings**
- **System maintenance reminders**

## Configuration Management

### System Settings
- **Global application configuration**
- **Feature flag management**
- **Integration settings**
- **UI customization options**

### Environment Configuration
- **Development vs. Production settings**
- **SSL/TLS configuration**
- **Database connection parameters**
- **External service integration**

## Access Control & Permissions

### Permission Matrix

| Function | ADMIN | MEMBER | VIEWER |
|----------|--------|---------|---------|
| User Management | ✅ | ❌ | ❌ |
| System Configuration | ✅ | ❌ | ❌ |
| Database Operations | ✅ | ❌ | ❌ |
| Backup/Restore | ✅ | ❌ | ❌ |
| Security Settings | ✅ | ❌ | ❌ |
| View User List | ✅ | ❌ | ❌ |
| Reset Passwords | ✅ | ❌ | ❌ |
| Deactivate Users | ✅ | ❌ | ❌ |

### Security Boundaries
- Admin functions require explicit role verification
- All administrative actions are logged
- Session validation on every admin operation
- CSRF protection on state-changing operations

## Best Practices

### User Management
- **Regular role reviews** - Audit user permissions quarterly
- **Principle of least privilege** - Assign minimum necessary permissions
- **Prompt deactivation** - Remove access for inactive users
- **Strong passwords** - Enforce complexity requirements

### System Administration
- **Regular backups** - Maintain current backup schedules
- **Monitor performance** - Watch for degradation indicators
- **Security updates** - Keep system components current
- **Access logging** - Review administrative action logs

### Security Maintenance
- **Password rotation** - Enforce regular password changes
- **Session management** - Monitor active sessions
- **Audit trails** - Regular review of security logs
- **Incident response** - Prepared procedures for security events

## Troubleshooting

### Common Issues

**Cannot Access Admin Panel:**
- Verify user has ADMIN role
- Check authentication status
- Confirm session is not expired

**User Creation Fails:**
- Verify email format is valid
- Check for duplicate usernames
- Ensure database connectivity

**Password Reset Issues:**
- Confirm email configuration
- Check SMTP settings
- Verify user account is active

**Database Connection Problems:**
- Verify Neo4j service is running
- Check connection credentials
- Monitor database logs

### Support Resources
- **System logs**: Available in admin panel
- **Error details**: Check browser console
- **Database status**: Monitor connection indicators
- **Performance metrics**: Review system dashboard

The GraphDone admin system provides comprehensive control over user management, security, and system operations while maintaining security boundaries and audit trails for all administrative actions.