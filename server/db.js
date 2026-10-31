import mongoose from 'mongoose';

/**
 * Connect to MongoDB Atlas using Mongoose.
 * Reads connection string from process.env.MONGODB_URI.
 */
export const connectDB = async (uri = process.env.MONGODB_URI) => {
  if (!uri) {
    const errorMsg = 'MONGODB_URI is not defined in environment variables';
    console.error(`MongoDB connection error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const parsedUri = new URL(uri);

console.log("MongoDB hostname:", parsedUri.hostname);
console.log("Environment variable loaded:", !!process.env.MONGODB_URI);
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
