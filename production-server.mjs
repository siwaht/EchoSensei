#!/usr/bin/env node

// Production server entry point for Replit deployment
// This directly imports and runs the TypeScript server

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set production environment
process.env.NODE_ENV = 'production';

// Ensure PORT is set
if (!process.env.PORT) {
  process.env.PORT = '5000';
}

console.log('Starting production server on port', process.env.PORT);

// Register tsx to handle TypeScript files
register('tsx/esm', pathToFileURL('./'));

// Import and run the server
try {
  await import('./server/index.ts');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}