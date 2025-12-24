import OTP from "../../models/OTP.model.js";
import User from "../../models/User.model.js";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";

export const verifyOTP = async(req,res)=>{

    try{
        const email = req.session.email;
        console.log(email);

        if(!email){
            return res.redirect("/signup");
        }
        const {otp} = req.body;

        const otpRecord = await OTP.findOne({
            email
        }).sort({createdAt:-1});

        if(!otpRecord){
            req.session.flash = {
                type:"error",
                message:"OTP Invalid or expired"
            };
            return res.redirect("/verify-otp");
        }

        if(otpRecord.attempts >=5){
            await OTP.deleteOne({_id:otpRecord._id});
             console.log("Too many attempts");
            req.session.flash = {
                type:"error",
                message:"Too many failed attempts. Please request a new OTP"
            };
            return res.redirect("/verify-otp");
           
        }



        if(otpRecord.otp !== otp){
            otpRecord.attempts+=1;
            await otpRecord.save();
             console.log("Low attempts");
             req.session.flash = {
                type:"error",
                message:`OTP invalid or expired. ${5 - otpRecord.attempts} attempts remaining`
            };
            return res.redirect("/verify-otp");
        }

        let user = await User.findOneAndUpdate({email},{isVerified:true},{new:true});

        if(!user){
            req.session.flash = {
                type:"error",
                message:"User Not Found"
            };
            return res.redirect("/verify-otp");
        }

        await OTP.deleteMany({email});
        
        console.log("User verified succesfully",user);

        req.session.flash = {
            type: "success",
            message: "Email verified successfully. Please log in."
        };

        delete req.session.email;

        res.redirect("/login");


    }catch(error){

        console.error('OTP Verify Error:', error);

        req.session.flash = {
                type:"error",
                message:"Failed to verify OTP"
            };
            return res.redirect("/verify-otp");
        }
    }


export const resendOTP = async (req,res)=>{
    try{

        const email = req.session.email;
        console.log(email);
        

        if(!email){
            return res.status(400).json({message:"Session expired.Please signup again."});
        }

        await sendOTP(email);
       

        return res.status(200).json({message:"OTP resent successfully"});

    }catch(error){

        if(error.message === "OTP_RATE_LIMIT"){
            return res.status(429).json({message:"Please wait 30 seconds before sending next OTP"});
        }

        console.error("Resend OTP error:",error);

        return res.status(500).json({message:"Failed to resend OTP"});

    }
};

