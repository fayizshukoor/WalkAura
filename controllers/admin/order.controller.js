import Inventory from "../../models/Inventory.model.js";
import Order from "../../models/Order.model.js";
import asyncHandler from "../../utils/asyncHandler.js";

export const getAllOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    search,
    status,
    sort = "newest",
  } = req.query;

  const currentPage = Number(page) || 1;
  const limit = 5;
  const skip = (currentPage - 1) * limit;

  const query = {};

  // Search By Order ID / Customer name / Phone
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");

    query.$or = [
      { orderId: regex },
      {"customerSnapshot.name": regex },
      {"customerSnapshot.email": regex},
      { "shippingAddress.fullName": regex },
      { "shippingAddress.phone": regex },
    ];
  }

  // Status filter
  if (status && status !== "all") {
    query.orderStatus = status;
  }

  //  Sorting
  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    amount_high: { "pricing.totalAmount": -1 },
    amount_low: { "pricing.totalAmount": 1 },
  };

  const sortQuery = sortOptions[sort] || { createdAt: -1 };

  // Fetch orders
  const [rawOrders, totalOrders] = await Promise.all([
    Order.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .select(`
        orderId
        customerSnapshot
        payment.method
        orderStatus
        createdAt
        pricing.totalAmount
        items.status
      `).lean(),

    Order.countDocuments(query),
  ]);

  // Deriving flag for return requested items
  const orders = rawOrders.map(order => ({
    ...order,
    hasReturnRequest: order.items?.some(
      item => item.status === "RETURN_REQUESTED"
    ),
  }));

  res.render("admin/orders", {
    layout: "layouts/admin",
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
      limit,
    },
  });
});




// Allowed admin status transitions
const ALLOWED_TRANSITIONS = {
  PENDING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status: newStatus } = req.body;


  if (!newStatus) {
    return res.status(400).json({
      success: false,
      message: "New status is required",
    });
  }

  const order = await Order.findOne({ orderId });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const currentStatus = order.orderStatus;

  //  Validate transition
  if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(newStatus)) {
    return res.status(400).json({
      success: false,
      message: `Cannot change status from ${currentStatus} to ${newStatus}`,
    });
  }

  const now = new Date();

  //  Update item-level status
  for (const item of order.items) {
    // Skip cancelled or returned items
    if (item.status === "CANCELLED" || item.status === "RETURNED") {
      continue;
    }


    item.status = newStatus;
    item.statusTimeline.push({
      status: newStatus,
      at: now,
    });
  }

  if(newStatus === "DELIVERED" && order.payment.method === "COD" && order.payment.status === "PENDING"){
    order.payment.status = "PAID";
  }

  // Update order-level status (summary)
  order.orderStatus = newStatus;

  //  Timestamps
  if (newStatus === "DELIVERED") {
    order.deliveredAt = now;
  }

  if (newStatus === "CANCELLED") {
    order.cancelledAt = now;
  }

  await order.save();

  return res.status(200).json({
    success: true,
    message: "Order status updated successfully",
    data: {
      orderId: order.orderId,
      orderStatus: order.orderStatus,
      updatedAt: now,
    },
  });
});





// Order details page
export const getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne({ orderId })
    .populate({
      path: "user",
      select: "name email phone",
    })
    .populate({
      path: "items.product",
      select: "name",
    })
    .populate({
      path: "items.variant",
      select: "color",
    });

  if (!order) {
    return res.status(404).render("admin/404", {
      message: "Order not found",
    });
  }

  return res.render("admin/order-details", {
    layout: "layouts/admin",
    order,
  });
});




// Approve Return Request
export const approveReturn = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;

  const order = await Order.findOne({ orderId });

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
      message: "Item not found",
    });
  }

  //  Validate return eligibility
  if (item.status !== "RETURN_REQUESTED") {
    return res.status(400).json({
      success: false,
      message: `Return cannot be approved. Current status: ${item.status}`,
    });
  }

  const now = new Date();

  // Mark item as returned
  item.status = "RETURNED";
  item.returnInfo.approvedAt = now;
  item.returnInfo.receivedAt = now; // simplified flow

  item.statusTimeline.push({
    status: "RETURNED",
    at: now,
  });

  // Restore stock
  await Inventory.findByIdAndUpdate(item.inventory, {
    $inc: { stock: item.quantity },
  });


  await order.save();

  return res.status(200).json({
    success: true,
    message: "Return approved successfully",
    data: {
      orderId: order.orderId,
      itemId: item._id,
      itemStatus: item.status,
    },
  });
});


// Return reject
export const rejectReturn = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      success: false,
      message: "Rejection reason is required",
    });
  }

  const order = await Order.findOne({ orderId });

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
      message: "Item not found",
    });
  }

  //  Validate return request state
  if (item.status !== "RETURN_REQUESTED") {
    return res.status(400).json({
      success: false,
      message: `Return cannot be rejected. Current status: ${item.status}`,
    });
  }

  const now = new Date();

  //  Reject return permenantly
  item.status = "RETURN_REJECTED";

  item.returnInfo.rejectedAt = now;
  item.returnInfo.rejectionReason = reason.trim();

  item.statusTimeline.push({
    status: "RETURN_REJECTED",
    at: now,
  });

  await order.save();

  return res.status(200).json({
    success: true,
    message: "Return request rejected",
    data: {
      orderId: order.orderId,
      itemId: item._id,
      itemStatus: item.status,
    },
  });
});
