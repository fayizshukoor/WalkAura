// models/coupon.model.js
import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
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

    validFrom: {
      type: Date,
      required: true,
    },

    validUntil: {
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

couponSchema.index({ code: 1 });
couponSchema.index({ validUntil: 1 });
couponSchema.index({ isActive: 1 });

export default mongoose.model("Coupon", couponSchema);
