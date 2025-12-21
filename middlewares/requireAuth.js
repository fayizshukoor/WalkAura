export const requireAuth = (req,res,next)=>{
    if(req.user){
        return next();
    }

    if(req.cookie?.refreshToken){
        
        return res.redirect("/refresh");
    }
    return res.redirect("/login");
}