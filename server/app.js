import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  credentials: true
}));

app.use(express.json());

// Auto-load all routes in routes/
const routesPath = path.join(__dirname, 'routes');
const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));

for (const file of routeFiles) {
  const routeModule = await import(`./routes/${file}`);
  const routeName = file.replace('.js', '');
  app.use(`/api/${routeName}`, routeModule.default);
  // Also register root health ping or specific mappings if needed
  if (routeName === 'health') {
    app.use('/api', routeModule.default);
  }
}

app.use(errorHandler);

export default app;
