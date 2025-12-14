import dotenv from "dotenv";
dotenv.config();
import express from "express";
import connectDB from "./config/db.js";


const app = express();

connectDB();


const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{
    console.log(`Server Running on port ${PORT}`);
})
