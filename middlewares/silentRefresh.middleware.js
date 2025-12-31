import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

export const silentRefresh = async (req,res,next)=>{

    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;

    // move to next if accessToken exist
    if(accessToken)
        return next();
    // move to next if no refreshToken
    if(!refreshToken)
        return next();


    try{
        const decoded = jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET);

        const user = await User.findById(decoded.userId);
        
        if(!user || user.isBlocked){
            res.clearCookie("accessToken");
            res.clearCookie("refreshToken");
            return next();
        }

        const newAccessToken = jwt.sign(
            {
                userId:user._id,
                role:user.role
            },
            process.env.JWT_ACCESS_SECRET,
            {expiresIn:"15m"}
        );

        res.cookie("accessToken",newAccessToken,{
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            maxAge:15*60*1000
        });

        //Attach user immediately
        req.user = {userId:user._id,role:user.role};

    }catch(error){
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

    }
    next();
};