import User from "../../models/User.model.js";
import OTP from "../../models/OTP.model.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.utils.js";
import cloudinary from "../../config/cloudinary.js";

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

// Edit Profile
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
export const showChangeEmail = async (req,res)=>{
    try{
        const user = await User.findById(req.user.userId);

        if(user.googleId){
            req.flash("error","Google users cannot change Email");
            return res.redirect("/profile");
        }
        return res.render("user/change-email");

    }catch(error){

    }
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

export const showVerifyEmailChangeOTP = async (req, res) => {
 try{
    
    const user = await User.findById(req.user.userId);

    if(!user || !user.pendingEmail){
        req.flash("error","No Email Change request found");
        return res.redirect("/profile/change-email");
    }

    return res.render("user/verify-otp", {
    actionUrl: "/profile/verify-email-change",
    resendUrl: "/profile/resend-email-change-otp",
    title: "Verify Your New Email",
    subtitle: "Enter the OTP sent to your new email address",
  });
 }catch(error){

    console.error("Show verify email change error:",error);
    req.flash("error","Something went wrong");
    return res.redirect("/profile/change-email");

 }
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

// Change Password

export const showChangePassword = async (req,res)=>{

   try{
        const user = await User.findById(req.user.userId);

        if(!user.password && user.googleId){
            req.flash("error","Google users cannot change password");
            return res.redirect("/profile");
        }
         return res.render("user/change-password");
   }catch(error){

   }

}

export const handleChangePassword  = async (req,res)=>{
     const { currentPassword, newPassword, confirmPassword } = req.body;

    try{
         if (!currentPassword || !newPassword || !confirmPassword) {
            req.flash("error","All fields are required" );
            return res.redirect("/profile/change-password");
        }

        if (newPassword.length < 6) {
            req.flash("error","Password must be at least 6 characters" );
            return res.redirect("/profile/change-password");
        }

        if (newPassword !== confirmPassword) {
            req.flash("error", "Passwords do not match" );
            return res.redirect("/profile/change-password");
        }

        if(currentPassword === newPassword){
            req.flash("error","Current password and New password cannot be same");
            return res.redirect("/profile/change-password");
        }

        const user = await User.findById(req.user.userId);

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            req.flash("error","Current password is incorrect");
            return res.redirect("/profile/change-password");
        }

        const hashedPassword = await bcrypt.hash(newPassword,10);

        user.password = hashedPassword;
        user.passwordChangedAt = new Date();    
        user.save();

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        res.cookie("accessToken",newAccessToken,{
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            maxAge:15*60*1000
        });

        res.cookie("refreshToken",newRefreshToken,{
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            maxAge:7*24*60*61*1000
        });

        req.flash("success","Password Changed Successfully");
        return res.redirect("/profile");

    }catch(error){
        console.error("Change password error:",error);
        req.flash("error","Something went Wrong");
        return res.redirect("/profile/change-password");
    }
}

export const handleAuthForgotPassword = async (req,res)=>{
    try{
         const user = await User.findById(req.user.userId);
         console.log(user);

         if (!user || !user.isVerified || user.isBlocked || !user.password) {
            req.flash("error", "Unable to process password reset");
            return res.redirect("/profile/change-password");
        }

         await sendOTP(user.email, "FORGOT_PASSWORD");

        req.session.email = user.email;
        req.session.otpPurpose = "FORGOT_PASSWORD";

        req.flash("success","An OTP has been sent to your registered email" );
        return res.redirect("/verify-otp");

    }catch(error){
         console.error("Auth forgot password error:", error);
        req.flash("error", "Failed to send OTP");
        return res.redirect("/profile/change-password");
    }
}


export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      req.flash("error", "Please select an image");
      return res.redirect("/profile");
    }

    const user = await User.findById(req.user.userId);

    // Remove old image
    if (user.profileImage?.public_id) {
      await cloudinary.uploader.destroy(user.profileImage.public_id);
    }

    // Upload new image
    const result = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
      {
        folder: "walkaura/profile",
        transformation: [
          { width: 300, height: 300, crop: "fill", gravity: "face" }
        ]
      }
    );

    user.profileImage = {
      url: result.secure_url,
      public_id: result.public_id
    };

    await user.save();

    req.flash("success", "Profile photo updated");
    res.redirect("/profile");

  } catch (error) {
    console.error(error);
    req.flash("error", "Upload failed");
    res.redirect("/profile");
  }
};

export const removeProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    // If no image exists
    if (!user.profileImage?.public_id) {
      req.flash("error", "No profile photo to remove");
      return res.redirect("/profile");
    }

    // Remove from Cloudinary
    await cloudinary.uploader.destroy(user.profileImage.public_id);

    // Remove from DB
    user.profileImage = null;
    await user.save();

    req.flash("success", "Profile photo removed");
    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    req.flash("error", "Failed to remove profile photo");
    res.redirect("/profile");
  }
};