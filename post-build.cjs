#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Running post-build fixes...');

// Create the production wrapper script as pure ES module
const wrapperScript = `#!/usr/bin/env node

// Production wrapper for Replit deployment
// Uses child_process to run tsx in a clean environment

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change to project root
const rootDir = resolve(__dirname, '..');
process.chdir(rootDir);

// Set production environment
process.env.NODE_ENV = 'production';

// Ensure PORT is set
if (!process.env.PORT) {
  process.env.PORT = '5000';
}

console.log('Starting production server on port', process.env.PORT);

// Run tsx with the server file directly (using --import for Node v20+)
const result = spawnSync('node', [
  '--import', 'tsx',
  'server/index.ts'
], {
  stdio: 'inherit',
  env: process.env,
  cwd: rootDir
});

if (result.error) {
  console.error('Failed to start server:', result.error);
  process.exit(1);
}

process.exit(result.status || 0);
`;

// Write the wrapper script to dist/index.js (as ES module)
const distPath = path.join(__dirname, 'dist', 'index.js');

// Write ES module wrapper directly
fs.writeFileSync(distPath, wrapperScript);
fs.chmodSync(distPath, '755');

// Copy the built client files to where the server expects them
const sourcePath = path.join(__dirname, 'dist', 'public');
const targetPath = path.join(__dirname, 'server', 'public');

// Remove old server/public if it exists
if (fs.existsSync(targetPath)) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

// Copy dist/public to server/public
if (fs.existsSync(sourcePath)) {
  fs.cpSync(sourcePath, targetPath, { recursive: true });
  console.log('Copied client build to server/public');
}

console.log('Post-build fixes complete!');