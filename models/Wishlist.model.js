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

    // Store when item was added 
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false } 
);

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One wishlist per user
      index: true,
    },

    items: [wishlistItemSchema],

    totalItems: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate 
wishlistItemSchema.index({ product: 1, variant: 1 }, { unique: true, sparse: true });

// Update totalItems before saving
wishlistSchema.pre("save", function (next) {
  this.totalItems = this.items.length;
  next();
});

export default mongoose.model("Wishlist", wishlistSchema);