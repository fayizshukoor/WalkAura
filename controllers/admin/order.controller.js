import Order from "../../models/Order.model.js";
import asyncHandler from "../../utils/asyncHandler.js";

// GET ALL ORDERS 
export const getAllOrders = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    search, 
    status, 
    sort = "newest" 
  } = req.query;

  const currentPage = Number(page) || 1;
  const limit = 10;
  const skip = (currentPage - 1) * limit;

  // Build query
  const query = {};

  // Search by Order ID 
  if (search && search.trim()) {

    query.orderId = { $regex: search.trim(), $options: "i" };
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
      .populate({
        path: "user",
        select: "name email phone",
      })
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .select("orderId orderStatus pricing createdAt user items"),
    Order.countDocuments(query),
  ]);

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
      limit: limit,
    },
  });
});