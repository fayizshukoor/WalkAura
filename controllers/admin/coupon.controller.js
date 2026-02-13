import { createCouponService, getCouponsService } from "../../services/coupon.service.js";
import asyncHandler from "../../utils/asyncHandler.js";

export const addCoupon = asyncHandler(async (req,res)=>{

    const coupon = await createCouponService(req.body);

    return res.status(201).json({success: true, message: "Coupon created successfully"})
})

export const getCouponsPage = asyncHandler(async (req,res) =>{

    const {page, limit, search} = req.query;

    const result = await getCouponsService({page, limit, search})
    return res.render("admin/coupons",{
        layout:"layouts/admin", 
        coupons:result.coupons,
        pagination: result.pagination,
        search: search || ""
    });
})