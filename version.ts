import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Single source of truth for version management
 * Reads version from root package.json
 */
export function getVersion(): string {
  try {
    const packagePath = join(__dirname, 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.warn('Could not read version from package.json, using fallback');
    return '0.3.1-alpha'; // fallback
  }
}

export const VERSION = getVersion();