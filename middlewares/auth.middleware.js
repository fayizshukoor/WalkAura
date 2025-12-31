import jwt from "jsonwebtoken";

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
        return next(); 
    }

}

export const redirectIfAuthenticated = (req,res,next)=>{
    if(req.user){
        return res.redirect("/home");
    }
    next();
}

export const noCache =  (req,res,next)=>{
    res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
}

export const requireOtpSession = (req, res, next) => {
  if (!req.session?.email) {
    return res.redirect("/signup");
  }
  next();
};
