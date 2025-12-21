import express from "express";
import {showHomePage} from "../controllers/user/home.controller.js";
import {showSignup,signup,showLogin,showVerifyOTP,login,logout} from "../controllers/user/auth.controller.js";
import {verifyOTP} from "../controllers/user/otp.controller.js";
import { refreshAccessToken } from "../controllers/user/refresh.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = express.Router();

router.get("/home",showHomePage);

router.get("/signup",showSignup);

router.post("/signup",signup);

router.get("/verify-otp",showVerifyOTP);

router.post("/verify-otp",verifyOTP);

router.get("/login",showLogin);

router.post("/login",login);

router.get("/refresh",refreshAccessToken)

router.get("/logout",logout);



export default router