import mongoose from "mongoose";

let connectionPromise: Promise<void> | null = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (connectionPromise) return connectionPromise;

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    throw new Error("MONGODB_URL environment variable is required");
  }

  connectionPromise = mongoose
    .connect(mongoUrl, {
      dbName: process.env.DATABASE_NAME || "gaming_rental",
    })
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((error) => {
      connectionPromise = null;
      console.error("MongoDB connection error:", error);
      throw error;
    });

  return connectionPromise;
}

// Eagerly start connection on module load
connectDB();
