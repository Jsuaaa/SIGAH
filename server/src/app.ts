import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { NODE_ENV } from './config/env';
import { errorHandler } from './middlewares/errorHandler.middleware';
import authRoutes from './routes/auth.routes';
import zonesRoutes from './routes/zones.routes';

const app = express();

// CORS — whitelist of allowed origins
// Note: same-origin requests (frontend served by this backend) don't trigger CORS,
// so this only matters for local dev (Vite at :5173) and any external clients.
const allowedOrigins = [
  'https://sigah.site',
  'https://www.sigah.site',
  'https://dev.sigah.site',
  'https://www.dev.sigah.site',
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000', // Express local
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests with no Origin header (curl, server-to-server, same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Global middlewares
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/zones', zonesRoutes);

// Global error handler (must be after all routes)
app.use(errorHandler);

// In production, serve the compiled React frontend
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));

  app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

export default app;
