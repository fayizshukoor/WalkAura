import AppError from "../utils/appError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

const notFoundHandler = (req,res,next)=>{
    next(new AppError(`Cannot Find ${req.originalUrl}`,HTTP_STATUS.NOT_FOUND));
};

export default notFoundHandler;