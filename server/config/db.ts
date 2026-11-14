import mongoose from "mongoose";

const connectDB = async () => {
    // Default to local MongoDB connection for backwards compatibility
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/social_scheduler";

    if (!mongoUri) {
        console.warn("MONGODB_URI is not set. Continuing without a database connection.");
        return;
    }
    
    console.log("Connecting to MongoDB...");
    console.log("URI:", mongoUri.replace(/\/\/.*:.*@/, "//***:***@"));

    mongoose.connection.on("connected", () => {
        console.log("mongodb atlas connected");
    });

    mongoose.connection.on("error", (error) => {
        console.error("MongoDB connection error:", error);
    });

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    } catch (error: any) {
        console.warn("MongoDB connection failed. Continuing without a database connection.");
        console.warn(error?.message || error);
    }
};

export default connectDB;