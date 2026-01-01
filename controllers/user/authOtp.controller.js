import OTP from "../../models/OTP.model.js";
import User from "../../models/User.model.js";
import crypto from "crypto";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";


export const showVerifyOTP = async(req,res)=>{

    try{

       return res.render("user/verify-otp",{
        actionUrl: "/verify-otp",
        resendUrl: "/resend-otp",
    });

    }catch(error){
        console.error("Error loading Verify OTP Page");
    }
}

export const verifyOTP = async(req,res)=>{

    try{
        const email = req.session.email;
        const purpose = req.session.otpPurpose;
        
        console.log(email,purpose);

        if(!email || !purpose){
            return res.redirect("/signup");
        }
        const {otp} = req.body;

        const otpRecord = await OTP.findOne({
            email,
            purpose
        }).sort({createdAt:-1});

        if(otpRecord?.attempts >=5){
            await OTP.deleteOne({_id:otpRecord._id});
             console.log("Too many attempts");
            req.flash("error","Too many failed attempts. Please request a new OTP");
            return res.redirect("/verify-otp");
           
        }

        if(!otpRecord){
            req.flash("error", "OTP invalid or expired");
            return res.redirect("/verify-otp");

        }

        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");


        if(otpRecord.otp !== hashedOtp){
            otpRecord.attempts+=1;
            await otpRecord.save();
             console.log("Low attempts");
            req.flash("error",`OTP invalid or expired. ${5 - otpRecord.attempts} attempts remaining`);
            return res.redirect("/verify-otp");
        }

        if(purpose === "SIGNUP"){
            let user = await User.findOneAndUpdate({email},{isVerified:true},{new:true});
            console.log("User verified succesfully",user);
            req.flash("success","Email verified Successfully.Please Login.");
            return res.redirect("/login");
        }

        if(purpose === "FORGOT_PASSWORD"){
            req.session.allowPasswordReset = true;
            return res.redirect("/reset-password");
        }

        await OTP.deleteMany({email,purpose});

        delete req.session.email;
        delete req.session.otpPurpose;

    }catch(error){

        console.error('OTP Verify Error:', error);

        req.flash("error","Failed to verify OTP");
        return res.redirect("/verify-otp");
        }
    }


export const resendOTP = async (req,res)=>{
    try{

        const email = req.session?req.session.email:null;
        const purpose = req.session.otpPurpose;

        console.log(email,purpose);
        

        if(!email || !purpose){
            return res.status(400).json({message:"Session expired.Please signup again."});
        }

        await sendOTP(email,purpose);

        let message;
       
        if(purpose === "SIGNUP"){
            message = "New OTP Sent to your email. Verify to Continue.";
        }else if(purpose === "FORGOT_PASSWORD"){
            message = "If an account exists with this email,You will receive an OTP shortly";
        }else{
            message = "If an account exists with this email,You will receive an OTP shortly";
        }


        return res.status(200).json({message});

    }catch(error){

        if(error.message === "OTP_RATE_LIMIT"){
            return res.status(429).json({message:"Please wait 30 seconds before sending next OTP"});
        }

        console.error("Resend OTP error:",error);

        return res.status(500).json({message:"Failed to resend OTP"});

    }
};

