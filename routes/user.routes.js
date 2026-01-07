import express from "express";

//Controller imports
import { showHomePage } from "../controllers/user/home.controller.js";
import {
  showSignup,
  showLogin,
  handleSignup,
  handleLogin,
  logout,
  handleForgotPassword,
  handleResetPassword,
  showForgotPassword,
  showResetPassword,
} from "../controllers/user/auth.controller.js";
import {
  showVerifyOTP,
  verifyOTP,
  resendOTP,
} from "../controllers/user/authOtp.controller.js";
import {
  showProfile,
  showEditProfile,
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "../controllers/user/profile.controller.js";

import { requestEmailChange, resendEmailChangeOTP, showChangeEmail, showVerifyEmailChangeOTP, verifyEmailChangeOTP } from "../controllers/user/profileEmail.controller.js";

import { handleAuthForgotPassword, handleChangePassword, showChangePassword } from "../controllers/user/profilePassword.controller.js";

import {
  addAddress,
  deleteAddress,
  showAddressManagement,
  updateAddress,
} from "../controllers/user/address.controller.js";

// Middleware imports
import { redirectIfAuthenticated, requireAuth } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { requireOtpSession } from "../middlewares/otp.middleware.js";
import { noCache } from "../middlewares/cache.middleware.js";


const router = express.Router();

router.get("/home", noCache, showHomePage);

router
  .route("/signup")
  .get(noCache, redirectIfAuthenticated, showSignup)
  .post(handleSignup);

router
  .route("/verify-otp")
  .get(noCache, requireOtpSession, showVerifyOTP)
  .post(verifyOTP);

router
  .route("/login")
  .get(noCache, redirectIfAuthenticated, showLogin)
  .post(handleLogin);

router.post("/resend-otp", resendOTP);

router.get("/logout", noCache, logout);

//Forgot Password

router
  .route("/forgot-password")
  .get(noCache, showForgotPassword)
  .post(handleForgotPassword);

router
  .route("/reset-password")
  .get(noCache, showResetPassword)
  .post(handleResetPassword);

// Profile

router.get("/profile", noCache, requireAuth, showProfile);

router
  .route("/profile/edit")
  .get(requireAuth, noCache, showEditProfile)
  .put(requireAuth, updateProfile);

//Profile Photo upload and Remove

router.post("/profile/upload-photo", requireAuth, upload.single("profileImage"), uploadProfilePhoto);
router.delete("/profile/remove-photo", requireAuth, removeProfilePhoto);

// Change Email

router.get("/profile/change-email", noCache, requireAuth, showChangeEmail);
router.post("/profile/change-email", requireAuth, requestEmailChange);

router.get("/profile/verify-email-change",noCache,requireAuth, showVerifyEmailChangeOTP );
router.post("/profile/verify-email-change", requireAuth, verifyEmailChangeOTP);

// Resend email change otp

router.post("/profile/resend-email-change-otp",requireAuth,resendEmailChangeOTP );

// Change Password Authenticated

router.get("/profile/change-password", noCache, requireAuth, showChangePassword);
router.post("/profile/change-password", noCache, requireAuth, handleChangePassword);

router.get("/forgot-password/authenticated", handleAuthForgotPassword);

/* Address Management */

router.get("/addresses", noCache, requireAuth, showAddressManagement);
router.post("/addresses/add", requireAuth, addAddress);

router.put("/addresses/:addressId", requireAuth, updateAddress);

router.delete("/addresses/:addressId", requireAuth, deleteAddress);

export default router;
