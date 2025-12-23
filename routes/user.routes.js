import express from "express";
import { showHomePage } from "../controllers/user/home.controller.js";
import {showSignup,signup,showLogin,showVerifyOTP,login,logout} from "../controllers/user/auth.controller.js";
import { resendOTP, verifyOTP } from "../controllers/user/otp.controller.js";
import { refreshAccessToken } from "../controllers/user/refresh.controller.js";
import { showProfile } from "../controllers/user/profile.controller.js";
import {showEditProfile,updateProfile} from "../controllers/user/profile.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = express.Router();

router.get("/home", showHomePage);

router
.route("/signup")
.get(showSignup)
.post(signup);

router
.route("/verify-otp")
.get(showVerifyOTP)
.post(verifyOTP);

router
.route("/login")
.get(showLogin)
.post(login);


router.post("/resend-otp",resendOTP);

router.get("/refresh", refreshAccessToken);

router.get("/profile", requireAuth, showProfile);

router
.route("/profile/edit")
.get(requireAuth, showEditProfile)
.post(requireAuth, updateProfile);

router.get("/logout", logout);

export default router;
