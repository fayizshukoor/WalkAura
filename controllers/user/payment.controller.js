import asyncHandler from "../../utils/asyncHandler.util.js";
import Order from "../../models/Order.model.js";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
} from "../../services/razorpay.service.js";
import { restoreStockAndCancel } from "../../services/order.service.js";


export const createRazorpayPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const userId = req?.user?.userId;

  const order = await Order.findOne({ orderId, user: userId });

  if (!order){
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  if (order.expiresAt && order.expiresAt < new Date()) {
    return res.status(400).json({ success: false, message: "Order expired" });
 }

  if (order.payment.method !== "RAZORPAY"){
    return res.status(400).json({ success: false, message: "Invalid payment method" });
  }
  if (order.payment.status === "PAID"){
    return res.status(400).json({ success: false, message: "Already paid" });
  }

  if (order.orderStatus !== "PENDING") {
    return res.status(400).json({
      success: false,
      message: "Order not in payable state",
    });
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

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  // Idempotency
  if (order.payment.status === "PAID") {
    return res.status(200).json({
      success: true,
      message: "Already processed",
    });
  }

  // Order must be in payable state
  if (order.orderStatus !== "PENDING") {
    return res.status(400).json({
      success: false,
      message: "Order not in payable state",
    });
  }

  // Expiry check
  if (order.expiresAt && order.expiresAt < new Date()) {
    return res.status(400).json({
      success: false,
      message: "Order expired",
    });
  }

  const isValid = verifyRazorpaySignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    order.payment.status = "FAILED";

    const cancellableItems = order.items.filter((item) => item.status === "PENDING");

      for (const item of cancellableItems) {
            item.status = "CANCELLED";
            item.cancellation = {
              reason: "Payment Failed",
              at: new Date(),
              by: "ADMIN",
            };
      
            item.statusTimeline.push({
              status: "CANCELLED",
              at: new Date()
            })
          }
          
    order.orderStatus = "CANCELLED";
    await order.save();

    return res.status(400).json({
      success: false,
      message: "Invalid signature",
    });
  }

  // Success
  order.payment.razorpayPaymentId = razorpay_payment_id;
  order.payment.razorpaySignature = razorpay_signature;
  order.payment.status = "PAID";
  order.payment.paidAt = new Date();
  order.orderStatus = "PLACED";

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