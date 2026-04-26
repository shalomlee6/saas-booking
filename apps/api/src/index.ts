import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDB, isDatabaseReady } from './config/db';
import { validateEnv } from './config/env';
import { businessRouter } from './routes/business';
import { authRouter } from './routes/auth';
import { customersRouter } from './routes/customers';
import { servicesRouter } from './routes/services';
import { appointmentsRouter } from './routes/appointments';
import { publicRouter } from './routes/public';
import { settingsRouter } from './routes/settings';
import { adminRouter } from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import {
  authRouteLimiter,
  publicRouteLimiter,
  apiRouteLimiter,
  adminRouteLimiter,
} from './middleware/rateLimits';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './utils/logger';

const env = validateEnv();

const app = express();

app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);

if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-e2e-test-seed-secret'],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(requestLogger);
app.use('/api/auth', authRouteLimiter, authRouter);
app.use('/api/business', apiRouteLimiter, businessRouter);
app.use('/api/customers', apiRouteLimiter, customersRouter);
app.use('/api/services', apiRouteLimiter, servicesRouter);
app.use('/api/appointments', apiRouteLimiter, appointmentsRouter);
app.use('/api/public', publicRouteLimiter, publicRouter);
app.use('/api/settings', apiRouteLimiter, settingsRouter);
app.use('/api/admin', adminRouteLimiter, adminRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'saas-booking-api' });
});

app.get('/api/ready', (_req, res) => {
  if (!isDatabaseReady()) {
    res.status(503).json({ status: 'not_ready', db: 'down' });
    return;
  }
  res.json({ status: 'ready', db: 'up' });
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use(errorHandler);

async function bootstrap() {
  await connectDB(env.MONGO_URI, env.NODE_ENV);

  app.listen(env.PORT, () => {
    logger.info('api_server_started', { port: env.PORT, nodeEnv: env.NODE_ENV });
    if (env.NODE_ENV === 'production') {
      if (process.env.ALLOW_PUBLIC_REGISTER === 'true') {
        logger.warn('public_registration_enabled_in_production');
      } else {
        logger.info('public_registration_disabled_or_gated');
      }
      const origin = process.env.CLIENT_ORIGIN || 'http://localhost:4200';
      logger.info('cors_origin_configured', { origin });
    }
  });
}

bootstrap().catch((err) => {
  logger.error('bootstrap_failed', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

export { app };
