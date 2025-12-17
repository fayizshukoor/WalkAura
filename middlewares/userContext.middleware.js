import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

export const userContext = async(req,res,next)=>{
    
    const token = req.cookies?.token;

    req.user = null;

    if(!token){
        res.locals.user = null;
        return next();  
    }

    try{

        const decoded =  jwt.verify(token,process.env.JWT_SECRET);

        const user =  await User.findById(decoded.userId);

        if(!user || user.isBlocked){
            res.clearCookie("token");
            req.user=null;
            return next();
        }

        req.user = user;

        req.locals.user = user;

        next();


    }catch(error){

        res.clearCookie("token");
        res.user = null;
        next();
    }
}