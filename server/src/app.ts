import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { NODE_ENV } from './config/env';
import { errorHandler } from './middlewares/errorHandler.middleware';
import authRoutes from './routes/auth.routes';
import zonesRoutes from './routes/zones.routes';
import sheltersRoutes from './routes/shelters.routes';
import familiesRoutes from './routes/families.routes';
import personsRoutes from './routes/persons.routes';
import warehousesRoutes from './routes/warehouses.routes';
import resourceTypesRoutes from './routes/resourceTypes.routes';
import inventoryRoutes from './routes/inventory.routes';
import alertThresholdsRoutes from './routes/alertThresholds.routes';
import donorsRoutes from './routes/donors.routes';
import donationsRoutes from './routes/donations.routes';
import scoringConfigRoutes from './routes/scoringConfig.routes';
import prioritizationRoutes from './routes/prioritization.routes';
import deliveriesRoutes from './routes/deliveries.routes';
import distributionPlansRoutes from './routes/distributionPlans.routes';
import relocationsRoutes from './routes/relocations.routes';
import healthVectorsRoutes from './routes/healthVectors.routes';
import auditLogsRoutes from './routes/auditLogs.routes';
import mapRoutes from './routes/map.routes';
import reportsRoutes from './routes/reports.routes';
import syncRoutes from './routes/sync.routes';

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
app.use('/api/v1/shelters', sheltersRoutes);
app.use('/api/v1/families', familiesRoutes);
app.use('/api/v1/persons', personsRoutes);
app.use('/api/v1/warehouses', warehousesRoutes);
app.use('/api/v1/resource-types', resourceTypesRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/alert-thresholds', alertThresholdsRoutes);
app.use('/api/v1/donors', donorsRoutes);
app.use('/api/v1/donations', donationsRoutes);
app.use('/api/v1/scoring-config', scoringConfigRoutes);
app.use('/api/v1/prioritization', prioritizationRoutes);
app.use('/api/v1/deliveries', deliveriesRoutes);
app.use('/api/v1/distribution-plans', distributionPlansRoutes);
app.use('/api/v1/relocations', relocationsRoutes);
app.use('/api/v1/health-vectors', healthVectorsRoutes);
app.use('/api/v1/audit-logs', auditLogsRoutes);
app.use('/api/v1/map', mapRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/sync', syncRoutes);

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
