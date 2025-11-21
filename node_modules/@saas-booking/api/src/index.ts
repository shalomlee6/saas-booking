import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'saas-booking-api' });
});

const PORT = Number(process.env.PORT || 5088);
const MONGO_URI = process.env.MONGO_URI || '';

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

