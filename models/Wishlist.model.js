import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    addedAt: {
      type: Date,
      default: Date.now,
    }
  },
  { _id: false }
);

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    items: [wishlistItemSchema],
  },
  { timestamps: true }
);

// Prevent duplicate product+variant
wishlistSchema.index(
  { user: 1, "items.product": 1, "items.variant": 1 },
);

export default mongoose.model("Wishlist", wishlistSchema);