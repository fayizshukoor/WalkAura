import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
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
    
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },
    
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    
    // Store price at time of adding to cart 
    priceAtAdd: {
      type: Number,
      required: true,
    },
    
    // Store offer details at time of adding
    offerPercentAtAdd: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, 
      index: true,
    },
    
    items: [cartItemSchema],
    
    totalItems: {
      type: Number,
      default: 0,
    },
    
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate items 
cartItemSchema.index({ inventory: 1 }, { unique: true, sparse: true });

export default mongoose.model("Cart", cartSchema);