import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { generateAdminAccessToken } from "../utils/adminTokens.util.js";

export const authenticateAdmin = (req, res, next) => {
  const accessToken = req.cookies?.adminAccessToken;

  if (!accessToken){
    return next();
  } 

  try {
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_ADMIN_ACCESS_SECRET
    );

    req.admin = decoded;
  } catch {
    // silent fail
  }

  next();
};


export const requireAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.redirect("/admin");
  }
  next();
};


export const redirectIfAdminAuthenticated = (req, res, next) => {
  if(req.admin){
        return res.redirect("/admin/dashboard");
    }
    next();
};

// silent refresh for admin

export const adminSilentRefresh = async (req, res, next) => {
  const accessToken = req.cookies?.adminAccessToken;
  const refreshToken = req.cookies?.adminRefreshToken;

  if (accessToken){
    return next();
  } 
  if (!refreshToken){
    return next();
  } 

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_ADMIN_REFRESH_SECRET
    );

    const admin = await User.findById(decoded.adminId); 

    if (!admin || admin.role !== "admin") {
      res.clearCookie("adminAccessToken");
      res.clearCookie("adminRefreshToken");
      return next();
    }

    const newAccessToken = generateAdminAccessToken(admin);

    res.cookie("adminAccessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60 * 1000
    });

    req.admin = { adminId: admin._id, role: "admin" };
  } catch {
    res.clearCookie("adminAccessToken");
    res.clearCookie("adminRefreshToken");
  }

  next();
};


