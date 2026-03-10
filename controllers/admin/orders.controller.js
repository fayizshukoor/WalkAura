import { calculateItemRefund } from "../../helpers/refund.helper.js";
import Inventory from "../../models/Inventory.model.js";
import Order from "../../models/Order.model.js";
import { creditToWallet } from "../../services/wallet.service.js";
import asyncHandler from "../../utils/asyncHandler.util.js";

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
  PENDING: ["PLACED", "SHIPPED", "CANCELLED"],
  PLACED: ["SHIPPED", "OUT_FOR_DELIVERY", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
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

  if (newStatus === "CANCELLED") {

    const cancellableItems = order.items.filter(
      (item) =>
        item.status !== "CANCELLED" &&
        item.status !== "RETURNED"
    );

    if (cancellableItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items can be cancelled",
      });
    }

    for (const item of cancellableItems) {
      item.status = "CANCELLED";

      item.cancellation = {
        reason: "Cancelled by Admin",
        at: now,
        by: "ADMIN",
      };

      item.statusTimeline.push({
        status: "CANCELLED",
        at: now,
      });

      // Restore stock
      await Inventory.findByIdAndUpdate(item.inventory, {
        $inc: { stock: item.quantity },
      });
    }

    // Refund if already paid
    if (order.payment.status === "PAID" || order.payment.status === "PARTIALLY_REFUNDED") {

      const remainingRefund =
        order.pricing.totalAmount - order.payment.refundedAmount;

      if (remainingRefund > 0) {
        await creditToWallet({
          userId: order.user,
          amount: remainingRefund,
          source: "ORDER_REFUND",
          orderId: order._id,
          referenceId: `ORDER_REFUND_${order._id}`,
          description: "Refund for admin cancelled order",
        });

        order.payment.refundedAmount += remainingRefund;
        order.payment.status = "REFUNDED";

        // Mark items refunded
        for (const item of order.items) {
          if (item.refundStatus !== "REFUNDED") {
            item.refundStatus = "REFUNDED";
            item.refundedAmount = calculateItemRefund(order, item);
          }
        }
      }
    }

    order.orderStatus = "CANCELLED";
    order.cancelledAt = now;

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        orderId: order.orderId,
        orderStatus: order.orderStatus,
      },
    });

  }

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

  if(item.refundStatus === "REFUNDED"){
    return res.status(400).json({
      success: false,
      message: "Item already refunded"
    })
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

  if(order.payment.status === "PAID" || order.payment.status === "PARTIALLY_REFUNDED"){

    const remainingRefund =order.pricing.totalAmount - order.payment.refundedAmount;

    const calculatedRefund = calculateItemRefund(order, item);

    // Check if this is the last refundable item
    const remainingItems = order.items.filter(
      (i) => i.refundStatus !== "REFUNDED"
    );

    let refundAmount;

    if (remainingItems.length === 1) {
      // Last refundable item absorbs rounding difference
      refundAmount = remainingRefund;
    } else {
      refundAmount = Math.min(calculatedRefund, remainingRefund);
    }
    
    await creditToWallet({
      userId: order.user,
      amount: refundAmount,
      source: "ORDER_RETURN",
      orderId: order._id,
      referenceId: `ORDER_REFUND_${order._id}_${itemId}`,
      description: "Refund for returned Item"
    });

    item.refundStatus = "REFUNDED";
    item.refundedAmount = refundAmount;

    order.payment.refundedAmount += refundAmount;

    const totalPaid = order.pricing.totalAmount;
    const refunded = order.payment.refundedAmount;

    if (refunded === 0) {
      order.payment.status = "PAID";
    } 
    else if (refunded > 0 && refunded < totalPaid) {
      order.payment.status = "PARTIALLY_REFUNDED";
    } 
    else if (refunded >= totalPaid) {
      order.payment.status = "REFUNDED";
    }


    const allItemsClosed = order.items.every(
      (item) =>
        item.status === "RETURNED" ||
        item.status === "CANCELLED"
    );
    
    if (allItemsClosed) {
      order.orderStatus = "RETURNED";
    }

  }

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


// Approve All Return Request
export const approveAllReturn = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne({ orderId });

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const returnableItems = order.items.filter(
    (item) =>
      item.status === "RETURN_REQUESTED" &&
      item.refundStatus !== "REFUNDED"
  );

  if (returnableItems.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No return requested items found",
    });
  }

  const now = new Date();

  let totalRefundForThisAction = 0;
  const remainingRefund =
    order.pricing.totalAmount - order.payment.refundedAmount;

  for (let i = 0; i < returnableItems.length; i++) {
    const item = returnableItems[i];

    // Update item status
    item.status = "RETURNED";
    item.returnInfo.approvedAt = now;
    item.returnInfo.receivedAt = now;

    item.statusTimeline.push({
      status: "RETURNED",
      at: now,
    });

    if (order.payment.status === "PAID" || order.payment.status === "PARTIALLY_REFUNDED") {
      const calculatedRefund = calculateItemRefund(order, item);

      // Check if this item is the last refundable item in the entire order
    const remainingNonRefundedItems = order.items.filter(
      (i) => i.refundStatus !== "REFUNDED",
    );

    const isLastRefundableItemInOrder =
      remainingNonRefundedItems.length === 1 &&
      remainingNonRefundedItems[0]._id.toString() === item._id.toString();

      let refundAmount;

      if (isLastRefundableItemInOrder) {
        // absorb rounding difference
        refundAmount =
          remainingRefund - totalRefundForThisAction;
      } else {
        refundAmount = Math.min(
          calculatedRefund,
          remainingRefund - totalRefundForThisAction
        );
      }

      if (refundAmount > 0) {
        await creditToWallet({
          userId: order.user,
          amount: refundAmount,
          source: "ORDER_RETURN",
          orderId: order._id,
          referenceId: `ORDER_REFUND_${order._id}_${item._id}`,
          description: "Refund for returned Item",
        });

        item.refundStatus = "REFUNDED";
        item.refundedAmount = refundAmount;

        totalRefundForThisAction += refundAmount;
      }
    }

    // Restore inventory
    await Inventory.findByIdAndUpdate(item.inventory, {
      $inc: { stock: item.quantity },
    });
  }

  // Update payment totals
  order.payment.refundedAmount += totalRefundForThisAction;

  const totalPaid = order.pricing.totalAmount;
  const refunded = order.payment.refundedAmount;
  
  if (refunded === 0) {
    order.payment.status = "PAID";
  } 
  else if (refunded > 0 && refunded < totalPaid) {
    order.payment.status = "PARTIALLY_REFUNDED";
  } 
  else if (refunded >= totalPaid) {
    order.payment.status = "REFUNDED";
  }

  const allItemsClosed = order.items.every(
    (item) =>
      item.status === "RETURNED" ||
      item.status === "CANCELLED"
  );
  
  if (allItemsClosed) {
    order.orderStatus = "RETURNED";
  }

  await order.save();

  return res.status(200).json({
    success: true,
    message: "All returns approved successfully",
    data: {
      orderId: order.orderId,
      totalRefundedNow: totalRefundForThisAction,
      totalRefundedOverall: order.payment.refundedAmount,
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
