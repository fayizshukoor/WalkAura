import User from "../../models/User.model.js";
import bcrypt from "bcryptjs";
import { sendOTP } from "../../utils/generateAndSendOtp.util.js";
import { generateAccessToken, generateRefreshToken} from "../../utils/userTokens.utils.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";

export const showSignup = (req, res) => {
  try {
    return res.render("user/signup");
  } catch (error) {
    console.log("error loading Signup");
    return res.status(500).send("Server error");
  }
};

export const handleSignup = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !/^[A-Za-z ]+$/.test(name)) {
    return res.render("user/signup", {
      error: "Name can only contain letters",
    });
  }

  if (name.length > 30 || name.length < 3) {
    return res.render("user/signup", {
      error: "Name should be between 3-30 characters",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.render("user/signup", {
      error: "Please enter a valid email address",
    });
  }

  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.render("user/signup", {
      error: "Please enter a valid Phone Number",
    });
  }

  if (password.length < 6) {
    return res.render("user/signup", {
      error: "Password need minimum 6 characters",
    });
  }

  const existingUser = await User.findOne({ email });

  if (existingUser && existingUser.googleId && !existingUser.password) {
    return res.render("user/signup", {
      error: "Email Already registered with Google login",
    });
  }
  if (existingUser && existingUser.isVerified) {
    return res.render("user/signup", { error: "Email Already Registered" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await User.findOneAndUpdate(
    { email },
    {
      name,
      phone,
      password: hashedPassword,
      isVerified: false,
    },
    { upsert: true, new: true }
  );

  try {
  await sendOTP(email, "SIGNUP");
} catch (error) {
  return res.render("user/signup", {
    error: error.message
  });
}


  req.session.email = email;
  req.session.otpPurpose = "SIGNUP";

  return res.redirect("/verify-otp");
});

export const showLogin = (req, res) => {
  try {
    return res.render("user/login");
  } catch (error) {
    console.log("error loading Login Page", error);
    res.status(500).send("Server error");
  }
};

export const handleLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user || !user.isVerified) {
    req.flash("error", "Incorrect Email or Password");
    return res.redirect("/login");
  }

  if (user.isBlocked) {
    req.flash("error", "Your account is Blocked");
    return res.redirect("/login");
  }

  if (user.role === "admin") {
    req.flash("error", "Admins cannot login from User Login");
    return redirect("/login");
  }

  if (user.googleId && !user.password) {
    req.flash(
      "error",
      "This account uses google login.Please continue with Google"
    );
    return res.redirect("/login");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    req.flash("error", "Incorrect email or Password");
    return res.redirect("/login");
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Clearing Old cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.redirect("/home");
});

export const logout = (req, res) => {
  try {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return res.redirect("/home");
  } catch (error) {
    console.error("Logout Error:", error);
    return res.redirect("/home");
  }
};

/* ------Password Controller--------*/

export const showForgotPassword = (req, res) => {
  try {
    //Clear any previous OTP
    delete req.session.email;
    delete req.session.otpPurpose;
    delete req.session.allowPasswordReset;

    res.render("user/forgot-password");
  } catch (error) {
    console.error("Error loading forgot password", error);
  }
};

export const handleForgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    req.flash("error", "Enter email Address");
    return res.redirect("/forgot-password");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    req.flash("error", "Enter valid email Address");
    return res.redirect("/forgot-password");
  }

  const user = await User.findOne({ email });

  if (user && user.isVerified && !user.isBlocked && user.password) {


  try {
  await sendOTP(email, "FORGOT_PASSWORD");
} catch (error) {
  return res.render("user/forgot-password", {
    error: error.message
  });
}




    req.session.email = email;
    req.session.otpPurpose = "FORGOT_PASSWORD";
    req.flash(
      "success",
      "If an account exists with this email,You will receive an OTP shortly"
    );
    return res.redirect("/verify-otp");
  }

  req.flash("error", "Invalid Email");
  return res.redirect("/forgot-password");
});

export const showResetPassword = (req, res) => {
  if (!req.session.allowPasswordReset || !req.session.email) {
    return res.redirect("/forgot-password");
  }
  res.render("user/reset-password");
};

export const handleResetPassword = asyncHandler(async (req, res) => {
  const { password, confirmPassword } = req.body;

  if (!req.session.allowPasswordReset || !req.session.email) {
    return res.redirect("/forgot-password");
  }

  if (password.length < 6) {
    req.flash("error", "Password must be atleast 6 characters");
    return res.redirect("/reset-password");
  }

  if (password !== confirmPassword) {
    req.flash("error", "Passwords do not match");
    return res.redirect("/reset-password");
  }

  const user = await User.findOne({ email: req.session.email });
  if (!user) {
    return res.redirect("/forgot-password");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  user.password = hashedPassword;
  user.passwordChangedAt = new Date();
  await user.save();

  //invalidate

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  // Cleanup
  delete req.session.allowPasswordReset;
  delete req.session.email;
  delete req.session.otpPurpose;

  req.flash("success", "Password reset Successful.Please Login.");
  return res.redirect("/login");
});
