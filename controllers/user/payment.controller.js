import asyncHandler from "../../utils/asyncHandler.util.js";
import Order from "../../models/Order.model.js";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
} from "../../services/razorpay.service.js";
import { finalizeOrderAfterPayment } from "../../services/order.service.js";
import Cart from "../../models/Cart.model.js";

export const createRazorpayPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const userId = req?.user?.userId;

  const order = await Order.findOne({ orderId, user: userId });

  if (!order)
    return res.status(404).json({ success: false, message: "Order not found" });

  if (order.payment.method !== "RAZORPAY")
    return res.status(400).json({ success: false, message: "Invalid payment method" });

  if (order.payment.status === "PAID")
    return res.status(400).json({ success: false, message: "Already paid" });

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
  
    const order = await Order.findOne({
      "payment.razorpayOrderId": razorpay_order_id,
    });
  
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });
  
    // Idempotency protection
    if (order.payment.status === "PAID") {
      return res.status(200).json({ success: true, message: "Already processed" });
    }
  
    const cart = await Cart.findOne({ user: order.user });
  
    await finalizeOrderAfterPayment({ order, cart });
  
    order.payment.razorpayPaymentId = razorpay_payment_id;
    order.payment.status = "PAID";
    order.payment.paidAt = new Date();
  
    await order.save();
  
    return res.status(200).json({ success: true });
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