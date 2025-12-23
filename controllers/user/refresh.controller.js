import jwt from "jsonwebtoken";
import User from "../../models/User.model.js";

export const refreshAccessToken = async (req,res)=>{
    const refreshToken = req.cookies?.refreshToken;

    if(!refreshToken){
        return res.redirect("/login"); 
    }

    try{

        const decoded = jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET);
      

        const user = await User.findById(decoded.userId);
        

        if(!user || user.isBlocked){
           
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
                expiresIn:"15s"
            }
        );

        res.cookie("accessToken",newAccessToken,{
            httpOnly:true,
            secure:process.env.NODE_ENV === "production",
            sameSite:"strict",
            maxAge:15*1000
        });
        
        const redirectTo = req.session.returnTo || "Referer";
        delete req.session.returnTo;
        return res.redirect(redirectTo);


    }catch(error){
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        console.log("expired or Invalid");
        res.redirect("/login");

    }
}