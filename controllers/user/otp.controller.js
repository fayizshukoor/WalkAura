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
            return res.render("user/verify-otp",{error:"OTP Invalid or expired"});
        }

        if(otpRecord.attempts >=5){
            await OTP.deleteOne({_id:otpRecord._id});
             console.log("Too many attempts");
            return res.status(400).render("user/verify-otp",{error:"Too many failed attempts. Please request a new OTP"});
           
        }

        if(otpRecord.otp !== otp){
            otpRecord.attempts+=1;
            await otpRecord.save();
             console.log("Low attempts");
            return res.status(400).render("user/verify-otp",{error:`Invalid OTP. ${5 - otpRecord.attempts} attempts remaining` });
        }

        let user = await User.findOneAndUpdate({email},{isVerified:true},{new:true});

        if(!user){
            return res.render("user/verify-otp",{error:"User Not Found"});
        }

        await OTP.deleteMany({email});
        req.session.destroy();
        
        console.log("User verified succesfully",user);

        res.redirect("/login");


    }catch(error){

        console.error('OTP Verify Error:', error);
        res.status(500).render("user/verify-otp",{ error: "Failed to verify OTP" });
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
            return res.status(429).json({message:"Please wait 60 seconds before sending next OTP"});
        }

        console.error("Resend OTP error:",error);

        return res.status(500).json({message:"Failed to resend OTP"});

    }
};

