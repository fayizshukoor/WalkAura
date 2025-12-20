import express from "express";
import {showHomePage} from "../controllers/user/home.controller.js";
import {showSignup,signup,showLogin,showVerifyOTP} from "../controllers/user/auth.controller.js";
import {verifyOTP} from "../controllers/user/otp.controller.js";
import { userContext } from "../middlewares/userContext.middleware.js";

const router = express.Router();

router.get("/home",showHomePage);

router.get("/signup",showSignup);

router.post("/signup",signup);

router.get("/verify-otp",showVerifyOTP);

router.post("/verify-otp",verifyOTP);

router.get("/login",showLogin);



export default router