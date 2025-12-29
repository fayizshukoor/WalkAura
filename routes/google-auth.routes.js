import express from "express";
import passport from "passport";
import { googleCallback } from "../controllers/user/google-auth.controller.js";
import { noCache } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.get("/google",noCache,passport.authenticate("google",{scope:["profile","email"]}));

router.get(
  "/google/callback",
  noCache,
  passport.authenticate("google", { session: false, failureRedirect: "/login",failureFlash:true }),googleCallback);

export default router;