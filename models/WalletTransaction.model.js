import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true
    },

    source: {
      type: String,
      enum: [
        "ORDER_REFUND",
        "ORDER_PAYMENT",
        "REFERRAL_BONUS",
        "ORDER_RETURN"
      ],
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    },

    description: {
      type: String
    },

    referenceId: {
      type: String 
    }
  },
  { timestamps: true }
);

walletTransactionSchema.index({ wallet: 1, createdAt: -1 });

export default mongoose.model("WalletTransaction", walletTransactionSchema);
