export const requireAuth = (req,res,next)=>{
    if(req.user){
        return next();
    }else{
        return res.redirect("/login");
    }
}
  
    