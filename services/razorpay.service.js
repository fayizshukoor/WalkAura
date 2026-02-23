import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";

/**
 * Create Razorpay Order
 */
export const createRazorpayOrder = async ({ amount, receipt }) => {
  return await razorpayInstance.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt,
  });
};

/**
 * Verify Razorpay Signature
 */
export const verifyRazorpaySignature = ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  return expectedSignature === razorpay_signature;
};