import { startServer } from './app/server.js';

/**
 * Process entry point. Its only job is to start the server and to fail loudly if that is
 * impossible, so a misconfigured container exits immediately instead of serving errors.
 */
try {
  await startServer();
} catch (error: unknown) {
  // The logger may not exist yet (invalid configuration fails before the app is built).
  console.error('Failed to start server:', error);
  process.exit(1);
}
