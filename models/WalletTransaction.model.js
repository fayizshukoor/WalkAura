import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      enum: [
        "TOPUP",
        "ORDER_PAYMENT",
        "RETURN_REFUND"
      ],
      required: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    gatewayPaymentId: {
      type: String,
    },

    gatewayOrderId: {
      type: String,
    },

    referenceId: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ wallet: 1, createdAt: -1 });

export default mongoose.model("WalletTransaction", walletTransactionSchema);
