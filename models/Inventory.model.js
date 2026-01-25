import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },

    size: {
      type: Number,
      required: true
    },

    isActive:{
      type: Boolean,
      default :true
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    stock: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate size entries per variant
inventorySchema.index({ variant: 1, size: 1 }, { unique: true });

export default mongoose.model("Inventory", inventorySchema);
