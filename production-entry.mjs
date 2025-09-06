#!/usr/bin/env node

// Production entry point for Replit deployment
// This uses ES modules and dynamically imports the server

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set production environment
process.env.NODE_ENV = 'production';

// Ensure PORT is set
if (!process.env.PORT) {
  process.env.PORT = '5000';
}

console.log('Starting production server on port', process.env.PORT);

// Dynamically import tsx and then the server
try {
  // Register tsx for TypeScript support
  await import('tsx/esm/api').then(tsx => {
    tsx.register();
  });
  
  // Now import the server
  await import('./server/index.ts');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}