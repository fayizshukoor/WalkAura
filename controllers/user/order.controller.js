import Inventory from "../../models/Inventory.model.js";
import Order from "../../models/Order.model.js";
import asyncHandler from "../../utils/asyncHandler.js";

export const getOrderSuccess = async (req, res) => {
  const { orderId } = req.params;
  const userId = req?.user?.userId;

  const order = await Order.findOne({
    orderId,
    user: userId,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  res.render("user/order-success", {
    success: true,
    order,
  });
};

export const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req?.user?.userId;

  const order = await Order.findOne({
    orderId,
    user: userId,
  }).populate({
    path: "user",
    select: "name email",
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  res.render("user/order-details", {
    success: true,
    order,
  });
});


export const getUserOrders = asyncHandler(async (req, res) => {
    const userId = req?.user?.userId;
    const { page = 1, search, status, sort = "newest" } = req.query;
  
    const limit = 5;
    const currentPage = Number(page) || 1;
    const skip = (currentPage - 1) * limit;
  
    // Build query
    const query = { user: userId };
  
    // Search by Order ID or Product Name
    if (search && search.trim()) {
      query.$or = [
        { orderId: { $regex: search.trim(), $options: "i" } },
        { "items.productName": { $regex: search.trim(), $options: "i" } },
      ];
    }
  
    // Filter by order status
    if (status && status !== "all") {
      query.orderStatus = status;
    }
  
    // Sorting options
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      amount_high: { "pricing.totalAmount": -1 },
      amount_low: { "pricing.totalAmount": 1 },
    };
  
    const sortQuery = sortOptions[sort] || { createdAt: -1 };
  
    // Get orders and total count
    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .select("orderId orderStatus pricing createdAt items"),
      Order.countDocuments(query),
    ]);
  
    res.render("user/orders", {
      orders,
      filters: {
        search: search || "",
        status: status || "all",
        sort: sort || "newest",
      },
      pagination: {
        currentPage,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
      },
    });
});



// CANCEL SINGLE ITEM
export const cancelItem = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const { reason } = req.body;
  const userId = req?.user?.userId;

  const order = await Order.findOne({
    orderId,
    user: userId,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const item = order.items.id(itemId);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "Item not found in order",
    });
  }

  if (item.status !== "PENDING") {
    return res.status(400).json({
      success: false,
      message: `Cannot cancel this item. Current status: ${item.status}`,
    });
  }

  // Cancel the item
  item.status = "CANCELLED";
  item.cancellation = {
    reason: reason || "Cancelled by user",
    at: new Date(),
    by: "USER"
  }

  item.statusTimeline.push({
    status: "CANCELLED",
    at: new Date()
  })

  // Check if ALL items are now cancelled
  const allCancelled = order.items.every(i => i.status === "CANCELLED");
  if (allCancelled) {
    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
  }

  await order.save();

  // Increment stock
  await Inventory.findByIdAndUpdate(item.inventory, {
    $inc: { stock: item.quantity },
  });

  res.status(200).json({
    success: true,
    message: "Item cancelled successfully",
  });
});

// Cancel Entire Order
export const cancelEntireOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const userId = req?.user?.userId;

  const order = await Order.findOne({
    orderId,
    user: userId,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  let cancelledCount = 0;

  for (const item of order.items) {
    // Only cancel items that are still cancellable
    if (item.status === "PENDING") {
      item.status = "CANCELLED";
      item.cancellation = {
        reason: reason || "Cancelled by user",
        at: new Date(),
        by: "USER",
      };

      // Restore stock
      await Inventory.findByIdAndUpdate(item.inventory, {
        $inc: { stock: item.quantity },
      });

      cancelledCount++;
    }
  }

  if (cancelledCount === 0) {
    return res.status(400).json({
      success: false,
      message: "No items in this order can be cancelled",
    });
  }

  // If ALL items are cancelled → cancel the order
  const allCancelled = order.items.every(i => i.status === "CANCELLED");
  if (allCancelled) {
    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order cancellation processed successfully"
  });
});



// Request Return
export const requestReturn = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const { reason } = req.body;
  const userId = req?.user?.userId;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      success: false,
      message: "Return reason is required",
    });
  }

  const order = await Order.findOne({
    orderId,
    user: userId,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const item = order.items.id(itemId);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "Item not found in this order",
    });
  }

  // Eligibility checks
  if (item.status !== "DELIVERED") {
    return res.status(400).json({
      success: false,
      message: `Item cannot be returned. Current status: ${item.status}`,
    });
  }

  // Prevent duplicate return requests
  if (item.status === "RETURN_REQUESTED" || item.status === "RETURNED") {
    return res.status(400).json({
      success: false,
      message: "Return already requested for this item",
    });
  }

  const now = new Date();

  // Mark return requested
  item.status = "RETURN_REQUESTED";
  item.returnInfo = {
    reason: reason.trim(),
    requestedAt: now,
  };

  item.statusTimeline.push({
    status: "RETURN_REQUESTED",
    at: now,
  });

  await order.save();

  return res.status(200).json({
    success: true,
    message: "Return request submitted successfully"
  });
});



export const requestReturnEntireOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const userId = req?.user?.userId;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      success: false,
      message: "Return reason is required",
    });
  }

  const order = await Order.findOne({
    orderId,
    user: userId,
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  let eligibleCount = 0;
  const now = new Date();

  for (const item of order.items) {
    // Only delivered items can be returned
    if (item.status !== "DELIVERED") {
      continue;
    }

    // Prevent duplicate return requests
    if (
      item.status === "RETURN_REQUESTED" ||
      item.status === "RETURNED"
    ) {
      continue;
    }

    item.status = "RETURN_REQUESTED";
    item.returnInfo = {
      reason: reason.trim(),
      requestedAt: now,
    };

    item.statusTimeline.push({
      status: "RETURN_REQUESTED",
      at: now,
    });

    eligibleCount++;
  }

  if (eligibleCount === 0) {
    return res.status(400).json({
      success: false,
      message: "No items in this order are eligible for return",
    });
  }

  await order.save();

  return res.status(200).json({
    success: true,
    message: "Return request submitted for eligible items"
  });
});