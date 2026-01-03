import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../models/User.model.js";

// admin login

export const showAdminLogin = (req, res) => {
  res.render("admin/login", {
    layout: false
  });
};

//  admin Login POST

export const handleAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash("error", "All fields are required");
      return res.redirect("/admin");
    }

    const admin = await User.findOne({ email, role: "admin" });

    if (!admin) {
      req.flash("error", "Unauthorized access");
      return res.redirect("/admin");
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      req.flash("error", "Invalid credentials");
      return res.redirect("/admin");
    }

    const token = jwt.sign(
      {
        userId: admin._id,
        role: admin.role
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    res.redirect("/admin/dashboard");

  } catch (error) {
    console.error("Admin login error:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/admin");
  }
};

// Logout

export const adminLogout = (req, res) => {
  res.clearCookie("adminToken");
  res.redirect("/admin");
};
