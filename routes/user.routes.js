import express from "express";
import { showHomePage } from "../controllers/user/home.controller.js";
import {showSignup,signup,showLogin,login,logout} from "../controllers/user/auth.controller.js";
import { showVerifyOTP, verifyOTP, resendOTP} from "../controllers/user/otp.controller.js";
import { refreshAccessToken } from "../controllers/user/refresh.controller.js";
import { showProfile } from "../controllers/user/profile.controller.js";
import {showEditProfile,updateProfile} from "../controllers/user/profile.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { redirectIfAuthenticated,noCache,requireOtpSession } from "../middlewares/auth.middleware.js";
import passport from "passport";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.utils.js";
const router = express.Router();

router.get("/home",noCache,showHomePage);

router
.route("/signup")
.get(noCache,redirectIfAuthenticated,showSignup)
.post(signup);

router
.route("/verify-otp")
.get(noCache,requireOtpSession,showVerifyOTP)
.post(noCache,requireOtpSession,verifyOTP);

router
.route("/login")
.get(noCache,redirectIfAuthenticated,showLogin)
.post(login);

router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}));

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  (req, res) => {
    const user = req.user;

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect("/home");
  }
);



router.post("/resend-otp",requireOtpSession,resendOTP);

router.get("/refresh",noCache, refreshAccessToken);

router.get("/profile", noCache, requireAuth, showProfile);

router
.route("/profile/edit")
.get(requireAuth, noCache, showEditProfile)
.post(requireAuth, updateProfile);

router.get("/logout",noCache, logout);

export default router;
