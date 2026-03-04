import OTP from "../../models/OTP.model.js";
import User from "../../models/User.model.js";
import crypto from "crypto";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import asyncHandler from "../../utils/asyncHandler.util.js";

export const showVerifyOTP = (req, res) => {
  return res.render("user/verify-otp", {
    actionUrl: "/verify-otp",
    resendUrl: "/resend-otp",
  });
};

export const verifyOTP = asyncHandler(async (req, res) => {
  const email = req.session.email;
  const purpose = req.session.otpPurpose;
  const { otp } = req.body;

  if (!email || !purpose) {
    return res.status(400).json({ success: false, message: "Session expired. Please signup again.", redirectUrl: "/signup" });
  }

  const otpRecord = await OTP.findOne({ email, purpose }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return res.status(400).json({ success: false, message: "OTP invalid or expired" });
  }

  const expirationTime = 5 * 60 * 1000; 
  const isExpired = Date.now() - new Date(otpRecord.createdAt).getTime() > expirationTime;

if (isExpired) {
  await OTP.deleteOne({ _id: otpRecord._id });
  return res.status(400).json({ success: false, message: "OTP has expired" });
}

// Handle Too Many Attempts
  if (otpRecord?.attempts >= 5) {
    await OTP.deleteOne({ _id: otpRecord._id });
    return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new OTP" });
  }

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  if (otpRecord.otp !== hashedOtp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return res.status(400).json({ 
      success: false, 
      message: `OTP invalid. ${5 - otpRecord.attempts} attempts remaining` 
    });
  }

  // logic for SUCCESS
  await OTP.deleteMany({ email, purpose });

  if (purpose === "SIGNUP") {
    await User.findOneAndUpdate({ email }, { isVerified: true });
    return res.json({ success: true, message: "Email verified. Please Login.", redirectUrl: "/login" });
  }

  if (purpose === "FORGOT_PASSWORD") {
    req.session.allowPasswordReset = true;
    return res.json({ success: true, redirectUrl: "/reset-password" });
  }

  delete req.session.email;
  delete req.session.otpPurpose;
  return res.json({ success: true, redirectUrl: "/signup" });
});

// export const verifyOTP = asyncHandler(async (req, res) => {
//   const email = req.session.email;
//   const purpose = req.session.otpPurpose;

//   if (!email || !purpose) {
//     return res.redirect("/signup");
//   }
//   const { otp } = req.body;

//   const otpRecord = await OTP.findOne({
//     email,
//     purpose,
//   }).sort({ createdAt: -1 });

//   if (otpRecord?.attempts >= 5) {
//     await OTP.deleteOne({ _id: otpRecord._id });
//     req.flash("error", "Too many failed attempts. Please request a new OTP");
//     return res.redirect("/verify-otp");
//   }

//   if (!otpRecord) {
//     req.flash("error", "OTP invalid or expired");
//     return res.redirect("/verify-otp");
//   }

//   const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

//   if (otpRecord.otp !== hashedOtp) {
//     otpRecord.attempts += 1;
//     await otpRecord.save();
//     req.flash(
//       "error",
//       `OTP invalid or expired. ${5 - otpRecord.attempts} attempts remaining`,
//     );
//     return res.redirect("/verify-otp");
//   }

//   if (purpose === "SIGNUP") {
//     await User.findOneAndUpdate(
//       { email },
//       { isVerified: true },
//       { new: true },
//     );
//     req.flash("success", "Email verified Successfully.Please Login.");
//     return res.redirect("/login");
//   }

//   if (purpose === "FORGOT_PASSWORD") {
//     req.session.allowPasswordReset = true;
//     return res.redirect("/reset-password"); // goes to auth controller
//   }

//   await OTP.deleteMany({ email, purpose });

//   delete req.session.email;
//   delete req.session.otpPurpose;

//   return res.redirect("/signup");
// });

export const resendOTP = async (req, res) => {
  try {
    const email = req.session ? req.session.email : null;
    const purpose = req.session.otpPurpose;


    if (!email || !purpose) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Session expired.Please signup again." });
    }

    await sendOTP(email, purpose);

    let message;

    if (purpose === "SIGNUP") {
      message = "New OTP Sent to your email. Verify to Continue.";
    } else if (purpose === "FORGOT_PASSWORD") {
      message = "OTP Resent .You will receive an OTP shortly";
    } else {
      message = "OTP Resent.You will receive an OTP shortly";
    }

    return res.status(HTTP_STATUS.OK).json({ message });
  } catch (error) {
    console.error(error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: "Failed to resend OTP" });
  }
};
