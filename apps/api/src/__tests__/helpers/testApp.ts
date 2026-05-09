import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from '../../routes/auth';
import { businessRouter } from '../../routes/business';
import { customersRouter } from '../../routes/customers';
import { servicesRouter } from '../../routes/services';
import { appointmentsRouter } from '../../routes/appointments';
import { publicRouter } from '../../routes/public';
import { settingsRouter } from '../../routes/settings';
import { adminRouter } from '../../routes/admin';
import { errorHandler } from '../../middleware/errorHandler';

/**
 * Builds a test Express app with all routes but WITHOUT rate limiters.
 * Does NOT call connectDB or start a server — lifecycle managed by the test.
 */
export function buildTestApp(): express.Application {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRouter);
  app.use('/api/business', businessRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/admin', adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
