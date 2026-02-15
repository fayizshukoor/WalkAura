import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { createCouponService, editCouponService, getCouponsService, softDeleteCouponService, toggleCouponStatusService } from "../../services/coupon.service.js";
import asyncHandler from "../../utils/asyncHandler.js";



export const getCouponsPage = asyncHandler(async (req,res) =>{

    const {page, search} = req.query;

    const result = await getCouponsService({page, search})
    return res.render("admin/coupons",{
        layout:"layouts/admin", 
        coupons:result.coupons,
        pagination: result.pagination,
        search: search || ""
    });
})



export const getCouponsPageAjax = asyncHandler(async (req,res) =>{

    const {page, search} = req.query;

    const result = await getCouponsService({page, search})

    return res.status(200).json({
        success: true, 
        coupons:result.coupons,
        pagination: result.pagination,
        search: search || ""
    });
})

export const addCoupon = asyncHandler(async (req,res)=>{

    await createCouponService(req.body);

    return res.status(201).json({
        success: true, 
        message: "Coupon created successfully"
    });
});


export const editCoupon =  asyncHandler(async (req,res)=>{

    const { couponId } = req.params;

    await editCouponService(couponId, req.body);

    res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Coupon updated Successfully"
    })
});

export const toggleCouponStatus = asyncHandler(async (req, res)=>{
    
    const {couponId} = req.params;

    await toggleCouponStatusService(couponId);


    return res.status(200).json({
        success: true,
        message: "Coupon status updated"
    })
    
})

export const softDeleteCoupon = asyncHandler(async (req, res)=>{
    
    const {couponId} = req.params;

    await softDeleteCouponService(couponId);

    return res.status(200).json({
        success: true,
        message: "Coupon deleted"
    });
    
});