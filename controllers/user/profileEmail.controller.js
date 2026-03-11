import User from "../../models/User.model.js";
import crypto from "crypto";
import OTP from "../../models/OTP.model.js";
import asyncHandler from "../../utils/asyncHandler.util.js";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";

// Change Email
export const showChangeEmail = asyncHandler(async (req, res) => {
  const user = await User.findById(req?.user?.userId);

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
  if (emailExists && !emailExists.isVerified) {
    await User.deleteOne({ email: emailExists.email });
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

  if (!user || !user.pendingEmail) {
    return res.status(400).json({ success: false, message: "No email change request found", redirectUrl: "/profile/change-email" });
  }

  const email = user.pendingEmail;
  const purpose = "EMAIL_CHANGE";
  const otpRecord = await OTP.findOne({ email, purpose }).sort({ createdAt: -1 });

  if (otpRecord?.attempts >= 5) {
    await OTP.deleteMany({ email, purpose });
    return res.status(429).json({ success: false, message: "Too many attempts. Request a new OTP", redirectUrl: "/profile/change-email" });
  }

  if (!otpRecord) {
    return res.status(400).json({ success: false, message: "OTP invalid or expired" });
  }

  const expirationTime = 5 * 60 * 1000; 
    const isExpired = Date.now() - new Date(otpRecord.createdAt).getTime() > expirationTime;
  
  if (isExpired) {
    await OTP.deleteOne({ _id: otpRecord._id });
    return res.status(400).json({ success: false, message: "OTP has expired" });
  }

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  if (otpRecord.otp !== hashedOtp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return res.status(400).json({ success: false, message: `Invalid OTP. ${5 - otpRecord.attempts} attempts left.` });
  }

  // Update Email
  user.email = user.pendingEmail;
  user.pendingEmail = undefined;
  user.isVerified = true;
  await user.save();
  await OTP.deleteMany({ email: user.email, purpose });

  return res.json({ success: true, message: "Email updated successfully", redirectUrl: "/profile" });
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

    return res
      .status(200)
      .json({ message: "New OTP sent to confirm your email change" });
  } catch {
    return res.status(429).json({ message: "Failed to send OTP" });
  }
};
