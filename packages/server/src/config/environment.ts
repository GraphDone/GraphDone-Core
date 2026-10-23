import dotenv from 'dotenv';
import { validateProductionSecrets } from './secrets.js';

dotenv.config();
validateProductionSecrets(process.env);
