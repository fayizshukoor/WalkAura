import jwt from "jsonwebtoken";
import User from "../../models/User.model.js";

export const refreshAccessToken = async (req,res)=>{
    const refreshToken = req.cookie?.refreshToken;

    if(!refreshToken){
        return res.redirect("/login"); 
    }

    try{

        const decoded = jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET);

        const user = User.findById(decoded.userId);

        if(!user || user.isBlocked || user.refreshToken !== refreshToken){

            res.clearCookie("accessToken");
            res.clearCookie("refreshToken");

            return res.redirect("/login");
        }

        const newAccessToken = jwt.sign(
            {
                userId:user._id,
                role:user.role
            },
            process.env.JWT_ACCESS_SECRET,
            {
                expiresIn:"15m"
            }
        );

        res.cookie("accessToken",newAccessToken,{
            httpOnly:true,
            secure:NODE_ENV === "production",
            sameSite:"strict",
            maxAge:15*60*1000
        });
        console.log("new access token");
        return res.redirect("back");


    }catch(error){
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        res.redirect("/login");

    }
}