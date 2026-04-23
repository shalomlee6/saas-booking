import mongoose from 'mongoose';

export async function connectDB(uri: string, nodeEnv: 'development' | 'production' | 'test'): Promise<void> {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    console.error('   Check that MongoDB is running and MONGO_URI is correct:', uri);
    if (nodeEnv === 'production') {
      process.exit(1);
    }
    console.warn(
      '⚠️ Continuing without database in development — HTTP server will start; data routes will fail until MongoDB is available.'
    );
  }
}
