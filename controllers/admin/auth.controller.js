import bcrypt from "bcryptjs";
import User from "../../models/User.model.js";
import { generateAdminAccessToken, generateAdminRefreshToken } from "../../utils/adminTokens.util.js";

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

    // generate admin tokens
    const adminAccessToken = generateAdminAccessToken(admin);
    const adminRefreshToken = generateAdminRefreshToken(admin);

    // access token 
    res.cookie("adminAccessToken", adminAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60 * 1000 
    });

    //  refresh token
    res.cookie("adminRefreshToken", adminRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000 
    });

    return res.redirect("/admin/dashboard");

  } catch (error) {
    console.error("Admin login error:", error);
    req.flash("error", "Something went wrong");
    return res.redirect("/admin");
  }
};


// Logout

export const adminLogout = (req, res) => {
  res.clearCookie("adminAccessToken");
  res.clearCookie("adminRefreshToken");

  return res.status(200).json({message:"logout success"})
};
