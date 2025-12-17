import express from "express";
import {showHomePage} from "../controllers/user/home.controller.js";
import {showSignup,signup,showLogin} from "../controllers/user/auth.controller.js";

const router = express.Router();

router.get("/home",showHomePage);

router.get("/signup",showSignup);

router.post("/signup",signup);

router.get("/login",showLogin);

export default router