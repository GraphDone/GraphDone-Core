#!/usr/bin/env node

/**
 * Version update script for GraphDone monorepo
 * Updates version across all packages and Docker files
 */

const fs = require('fs');
const path = require('path');

function updatePackageJson(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pkg = JSON.parse(content);
  pkg.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${filePath}: ${newVersion}`);
}

function updateDockerFile(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content
    .replace(/gd-core-api:\d+\.\d+\.\d+-alpha/g, `gd-core-api:${newVersion}`)
    .replace(/gd-core-web:\d+\.\d+\.\d+-alpha/g, `gd-core-web:${newVersion}`);
  fs.writeFileSync(filePath, updated);
  console.log(`Updated Docker tags in ${filePath}: ${newVersion}`);
}

function updateEnvFile(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(/VITE_APP_VERSION=\d+\.\d+\.\d+-alpha/, `VITE_APP_VERSION=${newVersion}`);
  fs.writeFileSync(filePath, updated);
  console.log(`Updated ${filePath}: ${newVersion}`);
}

function updateClaudeFile(filePath, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(/\(v\d+\.\d+\.\d+-alpha\)/, `(v${newVersion})`);
  fs.writeFileSync(filePath, updated);
  console.log(`Updated ${filePath}: ${newVersion}`);
}

function main() {
  const newVersion = process.argv[2];
  
  if (!newVersion) {
    console.error('Usage: node scripts/update-version.js <version>');
    console.error('Example: node scripts/update-version.js 0.3.2-alpha');
    process.exit(1);
  }

  if (!/^\d+\.\d+\.\d+-alpha$/.test(newVersion)) {
    console.error('Version must match pattern: X.Y.Z-alpha');
    process.exit(1);
  }

  console.log(`Updating version to ${newVersion}...`);

  // Update package.json files
  const packageFiles = [
    'package.json',
    'packages/core/package.json',
    'packages/server/package.json',
    'packages/web/package.json',
    'packages/mcp-server/package.json'
  ];

  packageFiles.forEach(file => {
    if (fs.existsSync(file)) {
      updatePackageJson(file, newVersion);
    }
  });

  // Update Docker compose files
  const dockerFiles = [
    'deployment/docker-compose.yml',
    'deployment/docker-compose.http.yml'
  ];

  dockerFiles.forEach(file => {
    if (fs.existsSync(file)) {
      updateDockerFile(file, newVersion);
    }
  });

  // Update .env.example
  if (fs.existsSync('packages/web/.env.example')) {
    updateEnvFile('packages/web/.env.example', newVersion);
  }

  // Update CLAUDE.md
  if (fs.existsSync('CLAUDE.md')) {
    updateClaudeFile('CLAUDE.md', newVersion);
  }

  console.log(`\nVersion update complete! Don't forget to:`);
  console.log(`1. Run: npm install (to update package-lock.json)`);
  console.log(`2. Run: git add . && git commit -m "Update version to v${newVersion}"`);
  console.log(`3. Run: git push`);
}

main();