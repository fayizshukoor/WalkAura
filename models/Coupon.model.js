// models/coupon.model.js
import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    name: {
        type: String,
        required: true,
        trim: true,
      },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 90, 
    },

    maxDiscountAmount: {
      type: Number, 
    },

    minCartValue: {
      type: Number,
      default: 0,
    },

    usageLimit: {
      type: Number,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    perUserLimit: {
      type: Number,
      default: 1,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

couponSchema.index({ expiryDate: 1 });
couponSchema.index({ isActive: 1 });

export default mongoose.model("Coupon", couponSchema);
