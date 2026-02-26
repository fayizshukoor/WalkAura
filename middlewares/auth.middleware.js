import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { generateAccessToken } from "../utils/userTokens.utils.js";

export const authenticateUser = (req,res,next)=>{

    if(req.user){
        return next();
    }
    const accessToken = req.cookies?.accessToken;

    if(!accessToken){
        return next();
    }

    try{
        const decoded = jwt.verify(accessToken,process.env.JWT_ACCESS_SECRET); //returns payload if valid
        req.user = decoded;
        next();
        
    }catch(error){
        console.log("Error authenticating user",error);
        return next(); 
    }

}

export const requireAuth = (req,res,next)=>{
    if(req.user){
        return next();
    }else{
        return res.redirect("/login");
    }
}

export const redirectIfAuthenticated = (req,res,next)=>{
    if(req.user){
        return res.redirect("/");
    }
    next();
}

// Silent refresh for users

export const silentRefresh = async (req, res, next) => {
  const accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;

  // move to next if accessToken exist
  if (accessToken){
    return next();
  } 
  // move to next if no refreshToken
  if (!refreshToken){
    return next();
  } 

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user || user.isBlocked) {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return next();
    }

    const newAccessToken = generateAccessToken(user);

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000,
    });

    //Attach user immediately
    req.user = { userId: user._id, role: user.role };
  } catch (error) {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    console.log("Error in silent refresh:",error);
  }
  next();
};





