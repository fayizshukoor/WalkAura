import { calculateShipping } from "../helpers/shipping.helper.js";
import Address from "../models/Address.model.js";
import Cart from "../models/Cart.model.js";
import Coupon from "../models/Coupon.model.js";
import User from "../models/User.model.js";
import AppError from "../utils/appError";
import { generateOrderId } from "../utils/generateOrderId.util.js";
import { validateCouponForSubtotal } from "./coupon.service.js";

export const buildOrderData = async ({
    userId,
    addressId,
    paymentMethod,
    session,
  }) => {
    if (!["COD", "RAZORPAY", "WALLET"].includes(paymentMethod)) {
      throw new AppError("Invalid payment method",400);
    }
  
    const user = await User.findById(userId).select("name email");
    if (!user){
        throw new AppError("User not found",404);
    } 
  
    const address = await Address.findOne({
      _id: addressId,
      userId,
      isDeleted: false,
    });
  
    if (!address){
        throw new AppError("Invalid delivery address",400);
    } 
  
    // Get cart with populate
      const cart = await Cart.findOne({ user: userId })
        .populate({
          path: "items.product",
          select: "name price offerPercent offerExpiry isListed category",
          populate: {
            path: "category",
            select: "name offerPercent offerExpiry isListed isDeleted",
          },
        })
        .populate({
          path: "items.variant",
          select: "color images isActive",
        })
        .populate({
          path: "items.inventory",
          select: "size stock sku isActive",
        });
  
    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart is empty",400);
    }
  
    const orderItems = [];
  
    for (const item of cart.items) {
        const size = item.inventory?.size ?? "N/A";
        const color = item.variant?.color ?? "N/A";

      if (!item.product || !item.product.isListed){
        throw new AppError(`Product "${item.product?.name || "Unknown"}" is no longer available`,409);
      }  
      if (
        !item.product.category ||
        !item.product.category.isListed ||
        item.product.category.isDeleted
      ) {
        throw new AppError(
          `Product "${item.product.name}" category is no longer available`,
          409,
        );
      }
  
      if (!item.variant || !item.variant.isActive){
        throw new AppError(`Color ${color} for "${item.product.name}" is no longer available`,409);

      }  
      if (!item.inventory || !item.inventory.isActive){
        throw new AppError(`Size ${size} for "${item.product.name}" is no longer available`,409);
      }  
      if (item.inventory.stock < item.quantity){
        throw new AppError(`Insufficient stock for "${item.product.name}". Only ${item.inventory.stock} available on ${color} color of size ${size}`,409);
      }  
      const finalPrice = calculateFinalPrice({
        price: item.product.price,
        productOffer: item.product.offerPercent,
        productOfferExpiry: item.product.offerExpiry,
        categoryOffer: item.product.category.offerPercent,
        categoryOfferExpiry: item.product.category.offerExpiry,
      });
  
      orderItems.push({
        product: item.product._id,
        productName: item.product.name,
        variant: item.variant._id,
        color: item.variant.color,
        image: item.variant.images?.[0]?.url || "",
        inventory: item.inventory._id,
        size: item.inventory.size,
        sku: item.inventory.sku,
        quantity: item.quantity,
        price: finalPrice,
        itemTotal: finalPrice * item.quantity,
        status: "PENDING",
        statusTimeline: [{ status: "PENDING", at: new Date() }],
      });
    }
  
    const subtotal = orderItems.reduce((sum, item) => sum + item.itemTotal, 0);
  
    let discount = 0;
    let appliedCouponData = null;
  
    if (session?.appliedCoupon?.code) {
      const { coupon, discount: calculatedDiscount } =
        await validateCouponForSubtotal({
          userId,
          couponCode: session.appliedCoupon.code,
          subtotal,
        });
  
      const updatedCoupon = await Coupon.findOneAndUpdate(
        {
          _id: coupon._id,
          $or: [
            { usageLimit: { $exists: false } },
            { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
          ],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );
  
      if (!updatedCoupon)
        throw new AppError("Coupon usage limit exceeded",400);
  
      discount = calculatedDiscount;
  
      appliedCouponData = {
        coupon: coupon._id,
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
        discountAmount: discount,
      };
  
      session.appliedCoupon = null;
    }
  
    const discountedSubtotal = subtotal - discount;
    const tax = Math.round((discountedSubtotal * TAX_PERCENTAGE) / 100);
    const shippingCharge = calculateShipping(discountedSubtotal);
    const totalAmount = discountedSubtotal + tax + shippingCharge;
  
    const orderData = {
      orderId: generateOrderId(),
      user: userId,
      customerSnapshot: {
        name: user.name,
        email: user.email,
      },
      items: orderItems,
      shippingAddress: {
        fullName: address.fullName,
        phone: address.phone,
        streetAddress: address.streetAddress,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      payment: {
        method: paymentMethod,
        status: paymentMethod === "WALLET" ? "PAID" : "PENDING",
        refundedAmount: 0,
      },
      orderStatus: "PENDING",
      pricing: {
        subtotal,
        tax,
        taxPercentage: TAX_PERCENTAGE,
        shippingCharge,
        discount,
        totalAmount,
      },
      appliedCoupon: appliedCouponData,
    };
  
    return { orderData, cart };
  };