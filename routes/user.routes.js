import express from "express";
import { showHomePage } from "../controllers/user/home.controller.js";
import {showSignup,showLogin, handleSignup, handleLogin, logout, 
        handleForgotPassword, handleResetPassword, showForgotPassword, showResetPassword} from "../controllers/user/auth.controller.js";
import { showVerifyOTP, verifyOTP, resendOTP} from "../controllers/user/authOtp.controller.js";
import {showProfile,showEditProfile,updateProfile, showChangeEmail} from "../controllers/user/profile.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { redirectIfAuthenticated,noCache,requireOtpSession } from "../middlewares/auth.middleware.js";


const router = express.Router();

router.get("/home",noCache,showHomePage);

router
.route("/signup")
.get(noCache,redirectIfAuthenticated,showSignup)
.post(handleSignup);

router
.route("/verify-otp")
.get(noCache,redirectIfAuthenticated,requireOtpSession,showVerifyOTP)
.post(requireOtpSession,verifyOTP);

router
.route("/login")
.get(noCache,redirectIfAuthenticated,showLogin)
.post(handleLogin);


router.post("/resend-otp",requireOtpSession,resendOTP);

router.get("/logout",noCache, logout);


//Password routes

router
.route("/forgot-password")
.get(noCache,showForgotPassword)
.post(handleForgotPassword);

router
.route("/reset-password")
.get(noCache,showResetPassword)
.post(handleResetPassword);





//Profile 

router.get("/profile", noCache, requireAuth, showProfile);

router
.route("/profile/edit")
.get(requireAuth, noCache, showEditProfile)
.post(requireAuth, updateProfile);

//Email Change

router.get("/profile/change-email",showChangeEmail);

export default router;
