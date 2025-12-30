import User from "../../models/User.model.js"
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";
import bcrypt from "bcryptjs";

export const showForgotPassword = async (req,res)=>{
    try{
        //Clear any previous OTP
          delete req.session.email;
          delete req.session.otpPurpose;
          delete req.session.allowPasswordReset;
          
          res.render("user/forgot-password");

    }catch(error){
        console.error("Error loading forgot password",error);
    }
}

export const handleForgotPassword = async (req,res)=>{

   try{

         const {email} = req.body;

    if(!email){
        req.flash("error","Enter email Address");
        return res.redirect("/forgot-password");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if(!emailRegex.test(email)){
        req.flash("error","Enter valid email Address");
        return res.redirect("/forgot-password");
    }

    const user = await User.findOne({email});

    let otpCreated = false;

    if(user && user.isVerified && !user.isBlocked && user.password){
         await sendOTP(email,"FORGOT_PASSWORD");

        req.session.email = email;
        req.session.otpPurpose = "FORGOT_PASSWORD";
        otpCreated = true;

    }

    req.flash("success","If an account exists with this email,You will receive an OTP shortly");
    
    return otpCreated?res.redirect("/verify-otp"):res.redirect("/forgot-password");


   }catch(error){

    console.error("Error sending OTP",error);
    req.flash("error","Error sending OTP");
    return res.redirect("/forgot-password");

   }
}

export const showResetPassword = (req,res)=>{
    try{

        if(!req.session.allowPasswordReset || !req.session.email){
            return res.redirect("/forgot-password");
        }
        res.render('user/reset-password');
    }catch(error){
        console.error("Error loading reset Password",error);

    }
}

export const handleResetPassword = async (req,res)=>{
   try{

    const {password, confirmPassword} = req.body;

    if(!req.session.allowPasswordReset || !req.session.email){
        return res.redirect("/forgot-password");
    }

    if(password.length < 6){
        req.flash("error","Password must be atleast 6 characters");
        return res.redirect("/reset-password");
    }

    if(password !== confirmPassword){
        console.log(password);
        console.log(confirmPassword);
        req.flash("error","Passwords do not match");
        return res.redirect("/reset-password");
    }

    const hashedPassword = await bcrypt.hash(password,10);

    await User.findOneAndUpdate({email:req.session.email},{password:hashedPassword});

    // Cleanup
    delete req.session.allowPasswordReset;
    delete req.session.email;
    delete req.session.otpPurpose;

    req.flash("success","Password reset Successful.Please Login.");
    return res.redirect("/login");

   }catch(error){

    console.error("Reset Password Error:",error);
    req.flash("error","Failed to reset Password");
    return res.redirect("/reset-password");

   }
};