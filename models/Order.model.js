import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariant",
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Inventory",
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  sku: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  itemTotal: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["PENDING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURN_REQUESTED", "RETURNED"],
    default: "PENDING",
  },
  statusTimeline: [{
    status: String,
    at: Date
  }],

  cancellation: {
  reason: String,
  at: Date,
  by: { type: String, enum: ["USER", "ADMIN"] }
},

returnInfo: {
  reason: String,
  requestedAt: Date,
  approvedAt: Date,
  receivedAt: Date
}
});

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      streetAddress: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, required: true, default: "India" }
    },

    payment: {
      method: {
        type: String,
        enum: ["COD", "RAZORPAY", "WALLET"],
        required: true
      },
      status: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
        default: "PENDING"
      },
      transactionId: String,
      refundedAmount: { type: Number, default: 0 }
    },

    orderStatus: {
      type: String,
      enum: ["PENDING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
    pricing: {
      subtotal: { type: Number, required: true },
      tax: { type: Number, required: true },
      taxPercentage: { type: Number, default: 18 }, // Store tax percentage
      shippingCharge: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
    },
    deliveredAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

// Index for faster queries
orderSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Order", orderSchema);