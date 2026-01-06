import { HTTP_STATUS } from "../constants/httpStatus.js";

const errorHandler = (err,req,res,next)=>{
    console.error("error:",err);

     if (res.headersSent) {
    return next(err);
  }

    const statusCode = err.statusCode || HTTP_STATUS.iNTERNAL_SERVER_ERROR;

    // AJAX REQUESTS

    if(req.xhr || req.headers.accept?.includes("application/json")){
        return res.status(statusCode).json({
            success:false,
            message: statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR ? "Something went wrong. Try Again Later" : err.message
        });
    }

    if(statusCode === HTTP_STATUS.NOT_FOUND){
        return res.status(statusCode).render("user/404",{layout:false});
    }

    return res.status(HTTP_STATUS.iNTERNAL_SERVER_ERROR).render("user/500",{layout:false});
};

export default errorHandler;