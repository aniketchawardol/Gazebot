import mongoose from 'mongoose';

/**
 * Connect to MongoDB using the MONGODB_URI environment variable.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB.');
}

/**
 * Gracefully disconnect from MongoDB.
 */
export async function disconnectDB() {
  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}
