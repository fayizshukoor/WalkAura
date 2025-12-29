import express from "express";
import { showHomePage } from "../controllers/user/home.controller.js";
import {showSignup,signup,showLogin,login,logout} from "../controllers/user/auth.controller.js";
import { showVerifyOTP, verifyOTP, resendOTP} from "../controllers/user/otp.controller.js";
import { refreshAccessToken } from "../controllers/user/refresh-token.controller.js";
import {showProfile,showEditProfile,updateProfile} from "../controllers/user/profile.controller.js";
import { showForgotPassword, showResetPassword } from "../controllers/user/password.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { redirectIfAuthenticated,noCache,requireOtpSession } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/home",noCache,showHomePage);

router
.route("/signup")
.get(noCache,redirectIfAuthenticated,showSignup)
.post(signup);

router
.route("/verify-otp")
.get(noCache,redirectIfAuthenticated,requireOtpSession,showVerifyOTP)
.post(requireOtpSession,verifyOTP);

router
.route("/login")
.get(noCache,redirectIfAuthenticated,showLogin)
.post(login);


router.post("/resend-otp",requireOtpSession,resendOTP);

router.get("/refresh",noCache, refreshAccessToken);

router.get("/profile", noCache, requireAuth, showProfile);

router
.route("/profile/edit")
.get(requireAuth, noCache, showEditProfile)
.post(requireAuth, updateProfile);

router.get("/logout",noCache, logout);


//Password routes

router.get("/forgot-password",showForgotPassword);
router.get("/reset-password",showResetPassword);

export default router;
