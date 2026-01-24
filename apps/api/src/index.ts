import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { businessRouter } from './routes/business';
import { authRouter } from './routes/auth';
import { customersRouter } from './routes/customers';
import { servicesRouter } from './routes/services';
import { appointmentsRouter } from './routes/appointments';
import { publicRouter } from './routes/public';
import { settingsRouter } from './routes/settings';
import { adminRouter } from './routes/admin';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5173);
const MONGO_URI = process.env.MONGO_URI || '';

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // enable coockis
}));
app.use(cookieParser());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/business', businessRouter);
app.use('/api/customers', customersRouter);
app.use('/api/services', servicesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/public', publicRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'saas-booking-api' });
});



async function bootstrap() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI is not defined in .env');
    process.exit(1);
  }

  await connectDB(MONGO_URI);

  app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to bootstrap server:', err);
  process.exit(1);
});

export { app };

