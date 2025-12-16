import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import expressLayouts from "express-ejs-layouts";
import { fileURLToPath } from "url";
import userRoutes from "./routes/user.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));



app.use(express.static(path.join(__dirname,"public")))

app.use(expressLayouts);

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"))

app.set("layout","layouts/user")


app.use("/",userRoutes);

app.get("/login",(req,res)=>{
    res.render("user/signup",{user:false});
})

app.get("/home",(req,res)=>{
    res.render("user/home",{user:true});
})

app.get("/admin",(req,res)=>{
    res.render("user/verify-otp",{user:false});
})



export default app;

