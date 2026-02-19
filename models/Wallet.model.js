import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },

    totalCredited: {
      type: Number,
      default: 0,
      min: 0
    },

    totalDebited: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

export default mongoose.model("Wallet", walletSchema);
