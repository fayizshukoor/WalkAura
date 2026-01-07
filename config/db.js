// import dotenv from "dotenv";
// dotenv.config();
import mongoose from "mongoose";

const connectDB = async() =>{
    try{
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Connected Succesfully");
    }catch(error){
        console.log("MongoDB Connection Failed");
        process.exit(1);
    }

    // Add this temporarily to your database connection file
mongoose.connection.once('open', async () => {
    try {
        await mongoose.model('User').cleanIndexes(); // Removes indexes not in schema
        await mongoose.model('User').syncIndexes();  // Creates correct indexes
        console.log("Database indexes synchronized successfully.");
    } catch (err) {
        console.error("Error syncing indexes:", err);
    }
});
}

export default connectDB;

