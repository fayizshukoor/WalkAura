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




