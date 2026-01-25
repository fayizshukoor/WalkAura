import mongoose from "mongoose";

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    color: {
      type: String,
      required: true,
      trim: true,
    },

    images: {
      type: [
        {
          url: {
            type: String,
            required: true,
          },
          publicId: {
            type: String,
            required: true,
          },
        },
      ],
      validate: {
        validator: imgs => imgs.length >= 3 && imgs.length <= 4,
        message: "Each color variant must have 3 to 4 images",
      },
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate colors for same product
productVariantSchema.index({ product: 1, color: 1 }, { unique: true });

export default mongoose.model("ProductVariant", productVariantSchema);
