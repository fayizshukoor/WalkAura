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
}

export default connectDB;

