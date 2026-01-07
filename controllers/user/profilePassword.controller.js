import User from "../../models/User.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";
import {generateAccessToken, generateRefreshToken} from "../../utils/userTokens.utils.js";
import bcrypt from "bcryptjs";
// Change Password

export const showChangePassword = asyncHandler(async (req, res) => {
  
  const user = await User.findById(req.user.userId);

  if (!user.password && user.googleId) {
    req.flash("error", "Google users cannot change password");
    return res.redirect("/profile");
  }
  return res.render("user/change-password");

});

export const handleChangePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash("error", "All fields are required");
      return res.redirect("/profile/change-password");
    }

    if (newPassword.length < 6) {
      req.flash("error", "Password must be at least 6 characters");
      return res.redirect("/profile/change-password");
    }

    if (newPassword !== confirmPassword) {
      req.flash("error", "Passwords do not match");
      return res.redirect("/profile/change-password");
    }

    if (currentPassword === newPassword) {
      req.flash("error", "Current password and New password cannot be same");
      return res.redirect("/profile/change-password");
    }

    const user = await User.findById(req.user.userId);

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      req.flash("error", "Current password is incorrect");
      return res.redirect("/profile/change-password");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.save();

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 61 * 1000,
    });

    req.flash("success", "Password Changed Successfully");
    return res.redirect("/profile");

});



export const handleAuthForgotPassword = asyncHandler(async (req, res) => {

  const user = await User.findById(req.user.userId);
    console.log(user);

    if (!user || !user.isVerified || user.isBlocked || !user.password) {
      req.flash("error", "Unable to process password reset");
      return res.redirect("/profile/change-password");
    }

    await sendOTP(user.email, "FORGOT_PASSWORD");

    req.session.email = user.email;
    req.session.otpPurpose = "FORGOT_PASSWORD";

    req.flash("success", "An OTP has been sent to your registered email");
    return res.redirect("/verify-otp");

});