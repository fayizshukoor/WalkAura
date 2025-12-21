import User from "../models/User.model.js";

export const userContext = async(req,res,next)=>{
    
    if(!req.user?.userId){
        res.locals.user=null;
        return next();
    }

    const user = await User.findById(req.user.userId).lean();

    if(!user || user.isBlocked){
        res.locals.user = null;
        return next();
    }

    res.locals.user = user;
    console.log(user);
    next();
};
