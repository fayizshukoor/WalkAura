export const requireAuth = (req,res,next)=>{
    if(req.user){
        return next();
    }

    if(req.cookies?.refreshToken){
       req.session.returnTo = req.originalUrl;
        return res.redirect("/refresh");
    }
  
    return res.redirect("/login");
}