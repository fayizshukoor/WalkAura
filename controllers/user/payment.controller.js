import asyncHandler from "../../utils/asyncHandler.util.js";
import Order from "../../models/Order.model.js";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
} from "../../services/razorpay.service.js";
import { finalizeOrderAfterPayment } from "../../services/order.service.js";
import Cart from "../../models/Cart.model.js";
import mongoose from "mongoose";

export const createRazorpayPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const userId = req?.user?.userId;

  const order = await Order.findOne({ orderId, user: userId });

  if (!order){
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  if (order.payment.method !== "RAZORPAY"){
    return res.status(400).json({ success: false, message: "Invalid payment method" });
  }
  if (order.payment.status === "PAID"){
    return res.status(400).json({ success: false, message: "Already paid" });
  }
  
  const razorpayOrder = await createRazorpayOrder({
    amount: order.pricing.totalAmount,
    receipt: order.orderId,
  });

  order.payment.razorpayOrderId = razorpayOrder.id;
  await order.save();

  return res.status(200).json({
    success: true,
    razorpayOrder,
    key: process.env.RAZORPAY_KEY_ID,
  });
});


export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const order = await Order.findOne({
      "payment.razorpayOrderId": razorpay_order_id,
    });
  
    const isValid = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });
  
    if (!isValid){
      order.payment.status = "FAILED";
      await order.save();
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
  
  
    if (!order){
      return res.status(404).json({ success: false, message: "Order not found" });
    } 
     
    // Idempotency protection
    if (order.payment.status === "PAID") {
      return res.status(200).json({ success: true, message: "Already processed" });
    }
  
    const cart = await Cart.findOne({ user: order.user });

    const session = await mongoose.startSession();
  
    try {
      session.startTransaction();
  
      // Reload order inside session
      const orderInTxn = await Order.findById(order._id).session(session);
  
      // Finalize order (stock, coupon, cart, etc)
      await finalizeOrderAfterPayment({
        order: orderInTxn,
        cart,
        session,
      });
  
      // Update payment details
      orderInTxn.payment.razorpayPaymentId = razorpay_payment_id;
      orderInTxn.payment.status = "PAID";
      orderInTxn.payment.paidAt = new Date();
  
      await orderInTxn.save({ session });
  
      await session.commitTransaction();
      session.endSession();
  
      return res.status(200).json({ success: true });
  
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  });


  export const getPaymentFailedPage = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.userId;
  
    const order = await Order.findOne({ orderId, user: userId });
  
    if (!order) {
      return res.status(404).render("404");
    }
  
    // Prevent showing failed page if already paid
    if (order.payment.status === "PAID") {
      return res.redirect(`/order-success/${order.orderId}`);
    }
  
    return res.render("user/order-failure", {
      order,
    });
  });