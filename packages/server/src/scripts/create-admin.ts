import 'dotenv/config';
import {sqliteAuthStore} from '../auth/sqlite-auth.js';
await sqliteAuthStore.initialize();
const user=await sqliteAuthStore.findUserByEmailOrUsername('admin');
if(!user||user.role!=='ADMIN')throw Error('No administrator was created.');
console.log('Administrator exists in the SQLite authentication store.');
console.log('Username: admin. Production first-start generated credentials: data/bootstrap-admin.json, or your supplied ADMIN_PASSWORD.');
process.exit(0);
