// Vercel serverless entry: serves the Express app as a single function.
// Socket.IO and the interval-based order cleanup job (started in src/server.ts)
// need a long-running process and are not available in this mode.
import app from '../src/app.js';

export default app;
