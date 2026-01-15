import Category from "../models/Category.model.js";
import asyncHandler from "./asyncHandler.js";

export const expireCategoryOffers = asyncHandler(async()=>{
    await Category.updateMany(
        {
            offer:{$gt:0},
            offerExpiry:{$lt:new Date()}
        },
        {
            $set:{ offer : 0,offerExpiry: null}
        }
    );
});