import mongoose from "mongoose";

// Review Schema
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Product Schema (PARENT)
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    gender: {
      type: String,
      enum: ["Men", "Women", "Unisex"],
      required: true,
    },

    // Shared pricing
    price: {
      type: Number,
      min: 0,
      required: true,
    },

    offerPercent: {
      type: Number,
      min: 0,
      max: 90,
    },

    offerExpiry: {
      type: Date,
    },

    isListed: {
      type: Boolean,
      default: true,
    },

    reviews: [reviewSchema],

    averageRating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
