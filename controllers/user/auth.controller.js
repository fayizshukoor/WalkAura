import User from "../../models/User.model.js";
import jwt from "jsonwebtoken"

export const showSignup = async(req,res)=>{
    try{
        return res.render("user/signup")
    }catch(error){
        console.log("error loading Signup");
        res.status(500).send("Server error");
    }
}

export const signup = async(req,res)=>{
    const {name,email,phone,password} = req.body;
    try{

        const newUser = new User({name,email,phone,password});
        await newUser.save();
        console.log(newUser);   
        return res.redirect("/login")

    }catch(error){
        console.error("Error Saving User",error);
        res.status(500).send("Internal Server Error");
    }
}

export const showLogin = async(req,res)=>{
    try{
        return res.render("user/login")
    }catch(error){
        console.log("error loading Login Page");
        res.status(500).send("Server error");
    }
}

export const login = async(req,res)=>{
    const {email,password} = req.body;

    
    

        const token = jwt.sign(
            {userId : user._id},
            process.env.JWT_SECRET,
            {expiresIn:"1d"}
        );

        res.cookie("token",token,{
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            sameSite:"strict"
        });

        res.redirect("/home")

 
}