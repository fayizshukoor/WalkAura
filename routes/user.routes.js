import express from "express";
import {loadHomePage} from "../controllers/user/home.controller.js";

const router = express.Router();

router.get("/home",loadHomePage);

export default router