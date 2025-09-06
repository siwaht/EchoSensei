#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Running post-build fixes...');

// Create the production wrapper script as ES module
const wrapperScript = `#!/usr/bin/env node

// Production wrapper for Replit deployment (ES Module)
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change to the project root directory
process.chdir(resolve(__dirname, '..'));

// Set production environment
process.env.NODE_ENV = 'production';

// Ensure PORT is set
if (!process.env.PORT) {
  process.env.PORT = '5000';
}

console.log('Starting production server on port', process.env.PORT);

// Run the TypeScript server directly with tsx
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd()
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== null) {
    process.exit(code);
  }
});
`;

// Write the wrapper script to dist/index.js
const distPath = path.join(__dirname, 'dist', 'index.js');
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