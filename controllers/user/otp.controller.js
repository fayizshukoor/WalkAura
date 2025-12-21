import OTP from "../../models/OTP.model.js";
import User from "../../models/User.model.js"

export const verifyOTP = async(req,res)=>{

    try{
        const email = req.session.email;

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

