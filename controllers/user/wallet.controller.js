import asyncHandler from "../../utils/asyncHandler.util.js";
import { creditToWallet, getWalletSummary, getWalletTransactions } from "../../services/wallet.service.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../../services/razorpay.service.js";
import WalletTransaction from "../../models/WalletTransaction.model.js";

export const getWalletPage = asyncHandler(async (req, res) => {
  const userId = req?.user?.userId;

  const page = parseInt(req.query.page) || 1;
  const limit = 5;

  const wallet = await getWalletSummary(userId);

  const {
    transactions,
    total,
    currentPage,
    totalPages
  } = await getWalletTransactions(wallet._id, page, limit);

  res.render("user/wallet", {
    wallet,
    transactions,
    pagination: {
      total,
      currentPage,
      totalPages
    }
  });
});


export const createWalletTopup = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.userId;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }


  const razorpayOrder = await createRazorpayOrder({
    amount,
    receipt: `TOPUP_${userId}`
  });



  return res.status(200).json({
    success: true,
    razorpayOrder,
    key: process.env.RAZORPAY_KEY_ID
  });
});

export const verifyWalletTopup = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount
  } = req.body;

  const userId = req.user.userId;

  const isValid = verifyRazorpaySignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  // checking already credited
  const existingTxn = await WalletTransaction.findOne({
    referenceId: razorpay_payment_id,
  });

  if (existingTxn) {
    return res.status(200).json({ success: true });
  }

  await creditToWallet({
    userId,
    amount: amount, 
    source: "TOPUP",
    referenceId: razorpay_payment_id,
    description: "Wallet Top-up via Razorpay"
  });

  return res.status(200).json({ success: true });
});