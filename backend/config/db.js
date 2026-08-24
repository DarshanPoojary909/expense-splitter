import mongoose from 'mongoose';

/**
 * Connect to MongoDB database using Mongoose
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000, // Timeout after 3s if MongoDB server is not running
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] ${error.message}`);
    console.warn('[Database] Note: Running without active MongoDB connection. Provide a valid MONGO_URI in .env to connect.');
  }
};

export default connectDB;
