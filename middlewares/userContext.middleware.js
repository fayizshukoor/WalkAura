import User from "../models/User.model.js";

export const userContext = async(req,res,next)=>{

    res.locals.hasRefreshSession = !!req.cookies?.refreshToken;

    res.locals.user = null;

    if(req.user?.userId){

        const user = await User.findById(req.user.userId).lean();

        if(user && !user.isBlocked){
            
            res.locals.user = user;
        }
    }
       
    next();
};
