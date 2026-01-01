import User from "../../models/User.model.js";
import OTP from "../../models/OTP.model.js";
import crypto from "crypto";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";
export const showProfile = async(req,res)=>{
    try{

        const user = res.locals.user;
        if(!user){
            return res.redirect("/login");
        }
        return res.render("user/profile",{user});

    }catch(error){

        console.error("Error loading Profile",error);
        res.status(500).send("Server Error");

    }
}


export const showEditProfile = async (req,res)=>{

    try{

        const user = res.locals.user;
        
        if(!user){
            return res.redirect("/login")
        }

        return res.render("user/edit-profile");

    }catch(error){

        console.error("Error loading Edit profile:",error);
        res.status(500).send("server error");
    }
}

export const updateProfile = async (req,res)=>{

    const userId = req.user.userId;
    const { name, phone} = req.body;

      try {

        if (!name || !/^[A-Za-z ]+$/.test(name)) {
          req.flash("error","Name can only contain letters and spaces");
          return res.redirect("/profile/edit");
            
        }

        if (name.trim().length > 30 || name.trim().length < 3) {
          req.flash("error","Name should be between 3-30 characters");
          return res.redirect("/profile/edit");
    }
    
        const phoneRegex =  /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
          req.flash("error","Please enter a valid Phone Number");
          return res.redirect("/profile/edit");
      }
    
      await User.findByIdAndUpdate(userId,{
        name:name.trim(),
        phone:phone?.trim()
      })
      req.flash("success","Profile updated successfully");
        return res.redirect("/profile");
      

    }catch(error){

        console.error("Error updating Profile:",error);
        return res.redirect("/profile");

    }
}

// Change Email
export const showChangeEmail = (req,res)=>{
    return res.render("user/change-email");
}

export const requestEmailChange = async (req,res)=>{
    try{
       
        const {newEmail} = req.body;
         
        const user = await User.findById(req.user.userId);

        if(!newEmail){
            req.flash("error","Please enter an Email");
            return res.redirect("/profile/change-email");
        }

        if(newEmail === user.email){
            console.log("hi");
            req.flash("error","New Email cannot be same as current email");
            return res.redirect("/profile/change-email");
        }

        const emailExists = await User.findOne({email:newEmail});

        if(emailExists && emailExists.isVerified){
            req.flash("error","Email already in use");
            return res.redirect("/profile/change-email");
        }

        user.pendingEmail = newEmail;
        await user.save();

       await sendOTP(newEmail,"EMAIL_CHANGE");

        req.flash("success","OTP sent to your Email");
        return res.redirect("/profile/verify-email-change");


    }catch(error){
        if (error.message === "OTP_RATE_LIMIT") {
        req.flash("error", "Please wait before requesting another OTP");
        return res.redirect("/profile/change-email");
    }

        console.error("Email change request error:", error);
        req.flash("error", "Something went wrong");
        return res.redirect("/profile/change-email");

    }
}

export const showVerifyEmailChangeOTP = (req, res) => {
  res.render("user/verify-otp", {
    actionUrl: "/profile/verify-email-change",
    resendUrl: "/profile/resend-email-change-otp",
    title: "Verify Your New Email",
    subtitle: "Enter the OTP sent to your new email address",
  });
};

export const verifyEmailChangeOTP = async (req,res)=>{
    try{
        const {otp} = req.body;
        const user = await User.findById(req.user.userId);

        if(!otp){
            req.flash("error","OTP is required");
            return res.redirect("/profile/verify-email-change");
        }

       if (!user || !user.pendingEmail) {
        req.flash("error", "No email change request found");
        return res.redirect("/profile/change-email");
    }

    const email = user.pendingEmail;
    const purpose = "EMAIL_CHANGE";

    // Fetch latest OTP
    const otpRecord = await OTP.findOne({
      email,
      purpose
    }).sort({ createdAt: -1 });

    if (otpRecord?.attempts >= 5) {
      await OTP.deleteMany({ email, purpose });
      req.flash(
        "error",
        "Too many failed attempts. Please request a new OTP"
      );
      return res.redirect("/profile/change-email");
    }

    // OTP not found
    if (!otpRecord) {
      req.flash("error", "OTP invalid or expired");
      return res.redirect("/profile/verify-email-change");
    }

    // Hash and Compare
     const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

     if (otpRecord.otp !== hashedOtp) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      req.flash("error",`OTP invalid or expired. ${5 - otpRecord.attempts} attempts remaining`);
      return res.redirect("/profile/verify-email-change");
    }

    //Email updating
    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.isVerified = true;
    await user.save();

    // Delete OTPs
    await OTP.deleteMany({ email: user.email, purpose });

    req.flash("success", "Email updated successfully");
    return res.redirect("/profile");        

    }catch(error){
    console.error("Verify Email Change OTP Error:", error);
    req.flash("error", "Failed to verify OTP");
    return res.redirect("/profile/verify-email-change");
    }
};


export const resendEmailChangeOTP = async (req,res)=>{

    try{
        const user = await User.findById(req.user.userId);

        if (!user || !user.pendingEmail) {
            return res.status(400).json({ message: "No pending email change request found" });
        }

         const email = user.pendingEmail;
        const purpose = "EMAIL_CHANGE";

        // Send OTP 
        await sendOTP(email, purpose);

        return res.status(200).json({ message: "New OTP sent to confirm your email change" });

    }catch(error){
         if (error.message === "OTP_RATE_LIMIT") {
            return res.status(429).json({ message: "Please wait 30 seconds before sending next OTP" });
        }

        console.error("Resend Email Change OTP error:", error);

        return res.status(500).json({ message: "Failed to resend OTP" });
  }
    
}