import User from "../../models/User.model.js";
import crypto from "crypto";
import OTP from "../../models/OTP.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";

// Change Email
export const showChangeEmail = asyncHandler(async (req, res) => {

    const user = await User.findById(req.user.userId);

    if (user.googleId) {
      req.flash("error", "Google users cannot change Email");
      return res.redirect("/profile");
    }
    return res.render("user/change-email");

});



export const requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail } = req.body;

  const user = await User.findById(req.user.userId);

  if (!newEmail) {
    req.flash("error", "Please enter an Email");
    return res.redirect("/profile/change-email");
  }

  if (newEmail === user.email) {
    req.flash("error", "New Email cannot be same as current email");
    return res.redirect("/profile/change-email");
  }

  const emailExists = await User.findOne({ email: newEmail });

  if (emailExists && emailExists.isVerified) {
    req.flash("error", "Email already in use");
    return res.redirect("/profile/change-email");
  }

  // deleting unverified user
  if(emailExists && !emailExists.isVerified){
    await User.deleteOne({email:emailExists.email});
    console.log("deleted unverified user");
  }
  user.pendingEmail = newEmail;
  await user.save();

 try {

  await sendOTP(newEmail, "EMAIL_CHANGE");

  } catch (error) {

    return res.render("user/change-email", { error: error.message });
  }


  req.flash("success", "OTP sent to your Email");
  return res.redirect("/profile/verify-email-change");

});



export const showVerifyEmailChangeOTP = asyncHandler(async (req, res) => {

  const user = await User.findById(req.user.userId);

    if (!user || !user.pendingEmail) {
      req.flash("error", "No Email Change request found");
      return res.redirect("/profile/change-email");
    }

    return res.render("user/verify-otp", {
      actionUrl: "/profile/verify-email-change",
      resendUrl: "/profile/resend-email-change-otp",
      title: "Verify Your New Email",
      subtitle: "Enter the OTP sent to your new email address",
    });

});



export const verifyEmailChangeOTP = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const user = await User.findById(req.user.userId);

  if (!otp) {
    req.flash("error", "OTP is required");
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
    purpose,
  }).sort({ createdAt: -1 });

  if (otpRecord?.attempts >= 5) {
    await OTP.deleteMany({ email, purpose });
    req.flash("error", "Too many failed attempts. Please request a new OTP");
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

    req.flash(
      "error",
      `OTP invalid or expired. ${5 - otpRecord.attempts} attempts remaining`
    );
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

});



export const resendEmailChangeOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user || !user.pendingEmail) {
      return res
        .status(400)
        .json({ message: "No pending email change request found" });
    }

    const email = user.pendingEmail;
    const purpose = "EMAIL_CHANGE";

    // Send OTP
    await sendOTP(email, purpose);

    return res.status(200).json({ message: "New OTP sent to confirm your email change" });

  } catch (error) {
      console.log("Error in resend OTP:",error);
      return res.status(429).json({ message: "Failed to send OTP" });
    
  }
};