import User from "../../models/User.model.js";
import asyncHandler from "../../utils/asyncHandler.js";

// show customers
export const showCustomers = asyncHandler(async (req, res) => {

  const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = {
      role: "user",
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ]
    };

    const [customers, totalCustomers] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCustomers / limit);

    res.render("admin/customers", {
      layout: "layouts/admin",
      customers,
      currentPage: page,
      totalPages,
      search
    })
  });

// Block and Unblock
export const toggleCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user || user.role !== "user") {
      return res.status(404).json({ success: false });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return res.status(200).json({
      success: true,
      isBlocked: user.isBlocked
    });

  } catch (error) {
    console.error("Toggle status error:", error);
    return res.status(500).json({ success: false });
  }
};
