import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN;
const allowedOrigins = clientOrigin
  ? clientOrigin.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or non-browser tools (curl, Postman)
    if (!origin) return callback(null, true);

    // Allow configured origins or any *.vercel.app deployment
    if (
      !clientOrigin ||
      clientOrigin === '*' ||
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin)
    ) {
      return callback(null, origin);
    }
    return callback(null, origin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-tz-offset']
}));

app.use(express.json());

// Auto-load all routes in routes/
const routesPath = path.join(__dirname, 'routes');
const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));

for (const file of routeFiles) {
  const routeModule = await import(`./routes/${file}`);
  const routeName = file.replace('.js', '');
  // Route mount mapping
  let mountPath = `/api/${routeName}`;
  if (routeName === 'practice') {
    mountPath = '/api/practice';
  } else if (routeName === 'chat') {
    mountPath = '/api/chat';
  }
  app.use(mountPath, routeModule.default);
  // Also register root health ping or specific mappings if needed
  if (routeName === 'health') {
    app.use('/api', routeModule.default);
  }
}

app.use(errorHandler);

export default app;
