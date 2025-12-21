import jwt from "jsonwebtoken";

export const authenticateUser =  async(req,res,next)=>{
    const accessToken = req.cookies?.accessToken;

    req.user = null;

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