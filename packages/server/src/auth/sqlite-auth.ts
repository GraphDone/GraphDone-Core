import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// SQLite-based authentication system
// Separate from Neo4j for better availability and security

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'VIEWER' | 'GUEST';
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isEmailVerified: boolean;
  team?: {
    id: string;
    name: string;
  } | null;
}

class SQLiteAuthStore {
  private db: sqlite3.Database | null = null;
  private initialized = false;

  private async getDb(): Promise<sqlite3.Database> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      // Store auth database in a persistent location
      const dbPath = path.join(process.cwd(), 'data', 'auth.db');
      
      // Ensure data directory exists
      const fs = require('fs');
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Connected to SQLite auth database:', dbPath);
          resolve(this.db!);
        }
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const db = await this.getDb();
    
    return new Promise((resolve, reject) => {
      // Create tables
      db.serialize(() => {
        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'USER',
            passwordHash TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            isActive BOOLEAN DEFAULT 1,
            isEmailVerified BOOLEAN DEFAULT 0
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Teams table
        db.run(`
          CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // User-Team memberships
        db.run(`
          CREATE TABLE IF NOT EXISTS user_teams (
            userId TEXT NOT NULL,
            teamId TEXT NOT NULL,
            role TEXT DEFAULT 'MEMBER',
            createdAt TEXT NOT NULL,
            PRIMARY KEY (userId, teamId),
            FOREIGN KEY (userId) REFERENCES users (id),
            FOREIGN KEY (teamId) REFERENCES teams (id)
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // User configuration table
        db.run(`
          CREATE TABLE IF NOT EXISTS user_config (
            userId TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            type TEXT DEFAULT 'string',
            updatedAt TEXT NOT NULL,
            PRIMARY KEY (userId, key),
            FOREIGN KEY (userId) REFERENCES users (id)
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Server configuration table
        db.run(`
          CREATE TABLE IF NOT EXISTS server_config (
            key TEXT PRIMARY KEY,
            value TEXT,
            type TEXT DEFAULT 'string',
            description TEXT,
            updatedAt TEXT NOT NULL
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Folder structure table for organizing graphs
        db.run(`
          CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parentId TEXT NULL,
            type TEXT NOT NULL DEFAULT 'user', -- 'user', 'team', 'system'
            ownerId TEXT NULL, -- userId for user folders, teamId for team folders, null for system
            color TEXT NULL,
            icon TEXT NULL,
            description TEXT NULL,
            position INTEGER DEFAULT 0,
            isExpanded BOOLEAN DEFAULT 1,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (parentId) REFERENCES folders (id) ON DELETE CASCADE,
            FOREIGN KEY (ownerId) REFERENCES users (id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Graph-to-folder mappings
        db.run(`
          CREATE TABLE IF NOT EXISTS graph_folders (
            graphId TEXT NOT NULL, -- Neo4j Graph ID
            folderId TEXT NOT NULL,
            position INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            PRIMARY KEY (graphId, folderId),
            FOREIGN KEY (folderId) REFERENCES folders (id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Folder permissions for team collaboration
        db.run(`
          CREATE TABLE IF NOT EXISTS folder_permissions (
            folderId TEXT NOT NULL,
            userId TEXT NOT NULL,
            permission TEXT NOT NULL DEFAULT 'VIEW', -- 'VIEW', 'EDIT', 'ADMIN'
            createdAt TEXT NOT NULL,
            PRIMARY KEY (folderId, userId),
            FOREIGN KEY (folderId) REFERENCES folders (id) ON DELETE CASCADE,
            FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
          )
        `, async (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          try {
            // Create default admin and viewer users
            await this.createDefaultUsers();
            // Create default folder structure
            await this.createDefaultFolders();
            this.initialized = true;
            resolve();
          } catch (defaultUsersError) {
            reject(defaultUsersError);
          }
        });
      });
    });
  }

  private async createDefaultFolders(): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      // Check if default folders exist
      db.get('SELECT id FROM folders WHERE name = ? AND type = ?', ['System', 'system'], async (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          // Create system folders
          const systemFolderId = uuidv4();
          const templatesFolderId = uuidv4();
          const aiFolderId = uuidv4();

          db.serialize(() => {
            // System folder
            db.run('INSERT INTO folders (id, name, type, ownerId, color, icon, description, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [systemFolderId, 'System', 'system', null, '#f97316', 'settings', 'Auto-generated and system graphs', 0, now, now]);

            // Templates folder under System
            db.run('INSERT INTO folders (id, name, parentId, type, ownerId, color, icon, description, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [templatesFolderId, 'Templates', systemFolderId, 'system', null, '#eab308', 'file-text', 'Reusable graph templates', 0, now, now]);

            // AI folder under System
            db.run('INSERT INTO folders (id, name, parentId, type, ownerId, color, icon, description, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [aiFolderId, 'AI Generated', systemFolderId, 'system', null, '#8b5cf6', 'bot', 'AI and bot created graphs', 1, now, now], (err) => {
                if (err) {
                  reject(err);
                } else {
                  console.log('✅ Default folder structure created');
                  resolve();
                }
              });
          });
        } else {
          console.log('📁 Default folders already exist');
          resolve();
        }
      });
    });
  }

  private async createDefaultUsers(): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      // Check if admin user exists
      db.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          // Create default team
          const teamId = uuidv4();
          const now = new Date().toISOString();

          db.run('INSERT INTO teams (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)', 
            [teamId, 'Development Team', now, now]);

          // Create admin user
          const adminId = uuidv4();
          const adminPasswordHash = await bcrypt.hash('graphdone', 10);
          
          db.run(`INSERT INTO users (id, email, username, name, role, passwordHash, createdAt, updatedAt, isActive, isEmailVerified) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [adminId, 'admin@graphdone.local', 'admin', 'Admin User', 'ADMIN', adminPasswordHash, now, now, 1, 1]);

          // Link admin to team
          db.run('INSERT INTO user_teams (userId, teamId, role, createdAt) VALUES (?, ?, ?, ?)',
            [adminId, teamId, 'OWNER', now]);

          // Create viewer user
          const viewerId = uuidv4();
          const viewerPasswordHash = await bcrypt.hash('viewer123', 10);
          
          db.run(`INSERT INTO users (id, email, username, name, role, passwordHash, createdAt, updatedAt, isActive, isEmailVerified) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [viewerId, 'viewer@graphdone.local', 'viewer', 'Viewer User', 'VIEWER', viewerPasswordHash, now, now, 1, 1]);

          // Link viewer to team
          db.run('INSERT INTO user_teams (userId, teamId, role, createdAt) VALUES (?, ?, ?, ?)',
            [viewerId, teamId, 'MEMBER', now], (err) => {
              if (err) {
                reject(err);
              } else {
                console.log('✅ Default users created:');
                console.log('   👤 admin / graphdone (ADMIN)');
                console.log('   👁️  viewer / viewer123 (VIEWER)');
                resolve();
              }
            });
        } else {
          console.log('👤 Default users already exist');
          resolve();
        }
      });
    });
  }

  async findUserByEmailOrUsername(emailOrUsername: string): Promise<User | null> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT u.*, t.id as teamId, t.name as teamName
        FROM users u
        LEFT JOIN user_teams ut ON u.id = ut.userId
        LEFT JOIN teams t ON ut.teamId = t.id
        WHERE u.email = ? OR u.username = ?
        AND u.isActive = 1
      `;
      
      db.get(sql, [emailOrUsername.toLowerCase(), emailOrUsername.toLowerCase()], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (row) {
          const user: User = {
            id: row.id,
            email: row.email,
            username: row.username,
            name: row.name,
            role: row.role,
            passwordHash: row.passwordHash,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            isActive: Boolean(row.isActive),
            isEmailVerified: Boolean(row.isEmailVerified),
            team: row.teamId ? {
              id: row.teamId,
              name: row.teamName
            } : null
          };
          resolve(user);
        } else {
          resolve(null);
        }
      });
    });
  }

  async findUserById(id: string): Promise<User | null> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT u.*, t.id as teamId, t.name as teamName
        FROM users u
        LEFT JOIN user_teams ut ON u.id = ut.userId
        LEFT JOIN teams t ON ut.teamId = t.id
        WHERE u.id = ?
        AND u.isActive = 1
      `;
      
      db.get(sql, [id], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (row) {
          const user: User = {
            id: row.id,
            email: row.email,
            username: row.username,
            name: row.name,
            role: row.role,
            passwordHash: row.passwordHash,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            isActive: Boolean(row.isActive),
            isEmailVerified: Boolean(row.isEmailVerified),
            team: row.teamId ? {
              id: row.teamId,
              name: row.teamName
            } : null
          };
          resolve(user);
        } else {
          resolve(null);
        }
      });
    });
  }

  async getAllUsers(): Promise<User[]> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT u.*, t.id as teamId, t.name as teamName
        FROM users u
        LEFT JOIN user_teams ut ON u.id = ut.userId
        LEFT JOIN teams t ON ut.teamId = t.id
        WHERE u.isActive = 1
        ORDER BY u.createdAt DESC
      `;
      
      db.all(sql, [], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const users = rows.map(row => ({
            id: row.id,
            email: row.email,
            username: row.username,
            name: row.name,
            role: row.role,
            passwordHash: row.passwordHash,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            isActive: Boolean(row.isActive),
            isEmailVerified: Boolean(row.isEmailVerified),
            team: row.teamId ? {
              id: row.teamId,
              name: row.teamName
            } : null
          }));
          resolve(users);
        }
      });
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async createUser(userData: {
    email: string;
    username: string;
    password: string;
    name: string;
    role?: 'USER' | 'VIEWER';
  }): Promise<User> {
    await this.initialize();
    const db = await this.getDb();
    
    const passwordHash = await bcrypt.hash(userData.password, 10);
    const userId = uuidv4();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO users (id, email, username, name, role, passwordHash, createdAt, updatedAt, isActive, isEmailVerified) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [userId, userData.email.toLowerCase(), userData.username.toLowerCase(), userData.name, userData.role || 'USER', passwordHash, now, now, 1, 0],
        function(err) {
          if (err) {
            reject(err);
          } else {
            // Return the created user
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row: any) => {
              if (err) {
                reject(err);
              } else {
                const user: User = {
                  id: row.id,
                  email: row.email,
                  username: row.username,
                  name: row.name,
                  role: row.role,
                  passwordHash: row.passwordHash,
                  createdAt: row.createdAt,
                  updatedAt: row.updatedAt,
                  isActive: Boolean(row.isActive),
                  isEmailVerified: Boolean(row.isEmailVerified),
                  team: null
                };
                resolve(user);
              }
            });
          }
        });
    });
  }

  // User configuration methods
  async getUserConfig(userId: string, key: string): Promise<any> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      db.get('SELECT value, type FROM user_config WHERE userId = ? AND key = ?', [userId, key], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (row) {
          // Parse value based on type
          let value = row.value;
          if (row.type === 'json') {
            try {
              value = JSON.parse(row.value);
            } catch (e) {
              value = row.value;
            }
          } else if (row.type === 'boolean') {
            value = row.value === 'true';
          } else if (row.type === 'number') {
            value = parseFloat(row.value);
          }
          resolve(value);
        } else {
          resolve(null);
        }
      });
    });
  }

  async setUserConfig(userId: string, key: string, value: any, type: string = 'string'): Promise<void> {
    await this.initialize();
    const db = await this.getDb();
    const now = new Date().toISOString();

    let stringValue = value;
    if (type === 'json') {
      stringValue = JSON.stringify(value);
    } else if (type === 'boolean') {
      stringValue = value ? 'true' : 'false';
    } else {
      stringValue = String(value);
    }

    return new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO user_config (userId, key, value, type, updatedAt) VALUES (?, ?, ?, ?, ?)`,
        [userId, key, stringValue, type, now], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
    });
  }

  // Server configuration methods
  async getServerConfig(key: string): Promise<any> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      db.get('SELECT value, type FROM server_config WHERE key = ?', [key], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (row) {
          // Parse value based on type
          let value = row.value;
          if (row.type === 'json') {
            try {
              value = JSON.parse(row.value);
            } catch (e) {
              value = row.value;
            }
          } else if (row.type === 'boolean') {
            value = row.value === 'true';
          } else if (row.type === 'number') {
            value = parseFloat(row.value);
          }
          resolve(value);
        } else {
          resolve(null);
        }
      });
    });
  }

  async setServerConfig(key: string, value: any, type: string = 'string', description?: string): Promise<void> {
    await this.initialize();
    const db = await this.getDb();
    const now = new Date().toISOString();

    let stringValue = value;
    if (type === 'json') {
      stringValue = JSON.stringify(value);
    } else if (type === 'boolean') {
      stringValue = value ? 'true' : 'false';
    } else {
      stringValue = String(value);
    }

    return new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO server_config (key, value, type, description, updatedAt) VALUES (?, ?, ?, ?, ?)`,
        [key, stringValue, type, description, now], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
    });
  }

  // Update user role
  async updateUserRole(userId: string, role: string): Promise<User> {
    await this.initialize();
    const db = await this.getDb();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET role = ?, updatedAt = ? WHERE id = ?', [role, now, userId], (err) => {
        if (err) {
          reject(err);
        } else {
          // Return updated user
          this.findUserById(userId).then(user => resolve(user!)).catch(reject);
        }
      });
    });
  }

  // Update user status (active/inactive)
  async updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    await this.initialize();
    const db = await this.getDb();
    const now = new Date().toISOString();
    const deactivationDate = isActive ? null : now;

    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET isActive = ?, deactivationDate = ?, updatedAt = ? WHERE id = ?', 
        [isActive ? 1 : 0, deactivationDate, now, userId], (err) => {
        if (err) {
          reject(err);
        } else {
          // Return updated user
          this.findUserById(userId).then(user => resolve(user!)).catch(reject);
        }
      });
    });
  }

  // Update user password
  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    await this.initialize();
    const db = await this.getDb();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?', 
        [passwordHash, now, userId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Delete user
  async deleteUser(userId: string): Promise<void> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // FOLDER MANAGEMENT METHODS

  // Create a new folder
  async createFolder(folderData: {
    name: string;
    parentId?: string;
    type: 'user' | 'team' | 'system';
    ownerId?: string;
    color?: string;
    icon?: string;
    description?: string;
    position?: number;
  }): Promise<any> {
    await this.initialize();
    const db = await this.getDb();
    const folderId = uuidv4();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO folders (id, name, parentId, type, ownerId, color, icon, description, position, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [folderId, folderData.name, folderData.parentId || null, folderData.type, folderData.ownerId || null, 
         folderData.color || null, folderData.icon || null, folderData.description || null, 
         folderData.position || 0, now, now],
        function(err) {
          if (err) {
            reject(err);
          } else {
            // Return the created folder
            db.get('SELECT * FROM folders WHERE id = ?', [folderId], (err, row: any) => {
              if (err) {
                reject(err);
              } else {
                resolve(row);
              }
            });
          }
        });
    });
  }

  // Get user's folder structure
  async getUserFolders(userId: string): Promise<any[]> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT f.*, 
          CASE 
            WHEN f.type = 'team' THEN t.name
            WHEN f.type = 'user' THEN u.name
            ELSE 'System'
          END as ownerName
        FROM folders f
        LEFT JOIN teams t ON f.type = 'team' AND f.ownerId = t.id
        LEFT JOIN users u ON f.type = 'user' AND f.ownerId = u.id
        WHERE 
          f.type = 'system' 
          OR (f.type = 'user' AND f.ownerId = ?)
          OR (f.type = 'team' AND f.ownerId IN (
            SELECT teamId FROM user_teams WHERE userId = ?
          ))
        ORDER BY f.type, f.position, f.name
      `;
      
      db.all(sql, [userId, userId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get folder contents (graphs in folder)
  async getFolderGraphs(folderId: string): Promise<any[]> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM graph_folders WHERE folderId = ? ORDER BY position', [folderId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Add graph to folder
  async addGraphToFolder(graphId: string, folderId: string, position: number = 0): Promise<void> {
    await this.initialize();
    const db = await this.getDb();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run('INSERT OR REPLACE INTO graph_folders (graphId, folderId, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [graphId, folderId, position, now, now], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
    });
  }

  // Remove graph from folder
  async removeGraphFromFolder(graphId: string, folderId: string): Promise<void> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      db.run('DELETE FROM graph_folders WHERE graphId = ? AND folderId = ?', [graphId, folderId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Update folder
  async updateFolder(folderId: string, updates: {
    name?: string;
    parentId?: string;
    color?: string;
    icon?: string;
    description?: string;
    position?: number;
    isExpanded?: boolean;
  }): Promise<any> {
    await this.initialize();
    const db = await this.getDb();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const updateFields = [];
      const values = [];

      if (updates.name !== undefined) {
        updateFields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.parentId !== undefined) {
        updateFields.push('parentId = ?');
        values.push(updates.parentId);
      }
      if (updates.color !== undefined) {
        updateFields.push('color = ?');
        values.push(updates.color);
      }
      if (updates.icon !== undefined) {
        updateFields.push('icon = ?');
        values.push(updates.icon);
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.position !== undefined) {
        updateFields.push('position = ?');
        values.push(updates.position);
      }
      if (updates.isExpanded !== undefined) {
        updateFields.push('isExpanded = ?');
        values.push(updates.isExpanded ? 1 : 0);
      }

      updateFields.push('updatedAt = ?');
      values.push(now, folderId);

      const sql = `UPDATE folders SET ${updateFields.join(', ')} WHERE id = ?`;

      db.run(sql, values, (err) => {
        if (err) {
          reject(err);
        } else {
          // Return updated folder
          db.get('SELECT * FROM folders WHERE id = ?', [folderId], (err, row: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          });
        }
      });
    });
  }

  // Delete folder
  async deleteFolder(folderId: string): Promise<void> {
    await this.initialize();
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      db.run('DELETE FROM folders WHERE id = ?', [folderId], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Create user's personal folders when they first log in
  async createUserPersonalFolders(userId: string, teamId?: string): Promise<void> {
    await this.initialize();
    const db = await this.getDb();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      // Check if user already has personal folders
      db.get('SELECT id FROM folders WHERE type = ? AND ownerId = ?', ['user', userId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          const personalFolderId = uuidv4();
          
          db.serialize(() => {
            // Personal root folder
            db.run('INSERT INTO folders (id, name, type, ownerId, color, icon, description, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [personalFolderId, 'Personal', 'user', userId, '#10b981', 'folder', 'My personal graphs', 0, now, now]);

            // Team folder if user is part of a team
            if (teamId) {
              const teamFolderId = uuidv4();
              db.run('INSERT INTO folders (id, name, type, ownerId, color, icon, description, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [teamFolderId, 'Team', 'team', teamId, '#3b82f6', 'users', 'Shared team graphs', 1, now, now], (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    console.log(`✅ Created folder structure for user ${userId}`);
                    resolve();
                  }
                });
            } else {
              console.log(`✅ Created personal folder structure for user ${userId}`);
              resolve();
            }
          });
        } else {
          resolve(); // Folders already exist
        }
      });
    });
  }
}

// Force restart to recreate database
export const sqliteAuthStore = new SQLiteAuthStore();