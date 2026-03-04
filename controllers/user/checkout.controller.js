import Address from "../../models/Address.model.js";
import Order from "../../models/Order.model.js";
import { getReconciledCart } from "../../services/cart.service.js";
import asyncHandler from "../../utils/asyncHandler.util.js";
import { applyCouponService, getAvailableCouponsForCheckoutService } from "../../services/coupon.service.js";
import { calculateShipping } from "../../helpers/shipping.helper.js";
import { debitFromWallet } from "../../services/wallet.service.js";
import Wallet from "../../models/Wallet.model.js";
import { buildOrderData } from "../../services/order.service.js";
import { TAX_PERCENTAGE } from "../../constants/app.constants.js";
import mongoose from "mongoose";
import Inventory from "../../models/Inventory.model.js";
import Coupon from "../../models/Coupon.model.js";


export const getCheckoutPage = asyncHandler(async (req, res) => {
  const userId = req?.user?.userId;

  // Get Cart with full details

  const result = await getReconciledCart(userId);
  // Check cart is empty

  if (!result || !result.cart || result.cart.items.length === 0) {
    if (result?.changes?.length) {
      req.session.cartChanges = result.changes;
    }

    // If it's an AJAX/Fetch request (from a button)
    if (req.xhr) {
      return res.status(409).json({
        success: false,
        cartEmpty: true,
        message: "Your cart is empty. Please add items before checkout.",
        changes: result?.changes || [],
      });
    }

    req.flash("error", "Cart is Empty");
    return res.redirect("/cart");
  }

  const { cart, hasChanges, changes } = result;

  if (hasChanges && changes.length > 0) {
    req.session.cartChanges = changes;
  }

  if (cart.items.length === 0 && hasChanges) {
    if (req.xhr) {
      return res.status(409).json({
        success: false,
        cartEmpty: true,
        message: "Items in your cart are no longer available.",
        changes,
      });
    }

    req.flash("error", "Items in your cart are no longer available.");
    return res.redirect("/cart");
  }

  if (hasChanges) {
    if (req.xhr) {
      return res.status(409).json({
        success: false,
        message: "Your cart was updated. Please review before checkout.",
        changes,
      });
    }

    req.flash(
      "error",
      "Some items in your cart were updated. Please review before checkout.",
    );
    return res.redirect("/cart");
  }

  // Get user addresses
  const addresses = await Address.find({
    userId: userId,
    isDeleted: false,
  }).sort({ isDefault: -1, createdAt: -1 });

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.priceAtAdd * item.quantity,
    0,
  );

  let discount = 0;
  let appliedCoupon = null;

  // Revalidate Applied Coupon From Session
  if (req.session.appliedCoupon?.code) {
    try {
      const couponResult = await applyCouponService({
        userId,
        couponCode: req.session.appliedCoupon.code,
      });

      discount = couponResult.pricing.discount;
      appliedCoupon = couponResult.coupon;
    } catch (err) {
      // Coupon no longer valid
      req.session.appliedCoupon = null;
    }
  }
  const discountedSubtotal = subtotal - discount;
  const tax = Math.round((discountedSubtotal * TAX_PERCENTAGE) / 100);
  const shippingCharge = calculateShipping(discountedSubtotal);
  const totalAmount = discountedSubtotal + tax + shippingCharge;

  // Fetch available coupons

  const availableCoupons = await getAvailableCouponsForCheckoutService({
    userId,
    cartSubtotal: subtotal,
  });

  // Wallet balance
  const wallet = await Wallet.findOne({user: userId}).lean();
  const walletBalance = wallet?.balance || 0;

  return res.render("user/checkout", {
    checkout: {
      items: cart.items.map((item) => ({
        product: item.product._id,
        productName: item.product.name,
        variant: item.variant._id,
        color: item.variant.color,
        image: item.variant.images[0]?.url || "",
        inventory: item.inventory._id,
        size: item.inventory.size,
        quantity: item.quantity,
        price: item.priceAtAdd,
        itemTotal: item.priceAtAdd * item.quantity,
      })),
      addresses,
      pricing: {
        subtotal,
        tax,
        shippingCharge,
        discount,
        totalAmount,
      },
      availableCoupons,
      appliedCoupon,
      userWalletBalance : walletBalance
    },
  });
});

export const applyCoupon = asyncHandler(async (req, res) => {
  const userId = req?.user?.userId;
  const { couponCode } = req.body;

  const result = await applyCouponService({ userId, couponCode });


  req.session.appliedCoupon = {
    couponId: result.coupon._id,
    code: result.coupon.code,
  };

  return res.status(200).json({
    success: true,
    message: "Coupon applied successfully",
    data: result,
  });
});

export const removeCoupon = asyncHandler(async (req, res) => {
  req.session.appliedCoupon = null;

  return res
    .status(200)
    .json({ success: true, message: "Coupon removed successfully" });
});



export const placeOrder = asyncHandler(async (req, res) => {
  const { addressId, paymentMethod = "COD" } = req.body;
  const userId = req?.user?.userId;

  const appliedCouponCode = req.session?.appliedCoupon?.code;

  const {orderData, cart} = await buildOrderData({
    userId,
    addressId,
    paymentMethod,
    appliedCouponCode
  });

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const expiresAt =
      paymentMethod === "RAZORPAY"
        ? new Date(Date.now() + 15 * 60 * 1000)
        : undefined;

    const orderArr = await Order.create(
      [
        {
          ...orderData,
          expiresAt,
        },
      ],
      { session }
    );

    const order = orderArr[0];

    //  STOCK RESERVATION (Atomic)
    for (const item of order.items) {
      const updated = await Inventory.findOneAndUpdate(
        { _id: item.inventory, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { session }
      );

      if (!updated) {
        return res.status(409).json({message: "Stock changed during payment finalization "})
      }
    }

    // Coupon increment
    if (order.appliedCoupon?.coupon) {
      const updatedCoupon = await Coupon.findOneAndUpdate(
        {
          _id: order.appliedCoupon.coupon,
          $or: [
            { usageLimit: { $exists: false } },
            { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
          ],
        },
        { $inc: { usedCount: 1 } },
        { session }
      );

      if (!updatedCoupon) {
        return res.status(400).json({message: "Coupon limit exceeded"});
      }
    }

    // Wallet handling
    if (paymentMethod === "WALLET") {
      await debitFromWallet({
        userId,
        amount: order.pricing.totalAmount,
        source: "ORDER_PAYMENT",
        orderId: order._id,
        description: "Wallet payment",
        session,
      });
    }

    // Clear cart
    cart.items = [];
    cart.totalItems = 0;
    cart.totalAmount = 0;
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    req.session.appliedCoupon = null;

    return res.status(201).json({
      success: true,
      order: {
        orderId: order.orderId,
        totalAmount: order.pricing.totalAmount,
      },
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
  
});
