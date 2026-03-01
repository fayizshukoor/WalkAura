import express from "express";

//Controller imports
import { getAboutPage, getContactPage, getHomePage, getPrivacyPage } from "../controllers/user/home.controller.js";

import { showSignup, showLogin, handleSignup, handleLogin, logout, handleForgotPassword, handleResetPassword, showForgotPassword, showResetPassword } from "../controllers/user/auth.controller.js";

import { showVerifyOTP, verifyOTP, resendOTP } from "../controllers/user/authOtp.controller.js";

import { showProfile, showEditProfile, updateProfile, uploadProfilePhoto, removeProfilePhoto } from "../controllers/user/profile.controller.js";

import { requestEmailChange, resendEmailChangeOTP, showChangeEmail, showVerifyEmailChangeOTP, verifyEmailChangeOTP } from "../controllers/user/profileEmail.controller.js";

import { handleAuthForgotPassword, handleChangePassword, showChangePassword } from "../controllers/user/profilePassword.controller.js";

import { addAddress, deleteAddress, getPincodeDetails, showAddressManagement, updateAddress} from "../controllers/user/address.controller.js";

import { getProductDetails, getProducts } from "../controllers/user/shop.controller.js";

import { addToCart, clearCart, getCart, removeCartItem, updateCartItemQuantity } from "../controllers/user/cart.controller.js";

import { applyCoupon, getCheckoutPage, placeOrder, removeCoupon } from "../controllers/user/checkout.controller.js";

import { getOrderDetails, getOrderSuccess, getUserOrders } from "../controllers/user/order.controller.js";

import { cancelEntireOrder, cancelItem } from "../controllers/user/orderCancel.controller.js";

import { requestReturn, requestReturnEntireOrder } from "../controllers/user/orderReturn.controller.js";

import { downloadInvoice } from "../controllers/user/invoice.controller.js";

import { createWalletTopup, getWalletPage, verifyWalletTopup } from "../controllers/user/wallet.controller.js";

import { addToWishlist, getVariantSizes, getWishlistPage, removeFromWishlist } from "../controllers/user/wishlist.controller.js";

import { createRazorpayPaymentOrder, getPaymentFailedPage, verifyRazorpayPayment } from "../controllers/user/payment.controller.js";

import { getReferralPage } from "../controllers/user/referral.controller.js";

// Middleware imports
import { redirectIfAuthenticated, requireAuth } from "../middlewares/auth.middleware.js";

import { upload } from "../middlewares/upload.middleware.js";

import { requireOtpSession } from "../middlewares/otp.middleware.js";

import { noCache } from "../middlewares/cache.middleware.js";


const router = express.Router();

router.get("/", noCache, getHomePage);
router.get("/about", getAboutPage);
router.get("/privacy",getPrivacyPage);
router.get("/contact",getContactPage);

router
  .route("/signup")
  .get(noCache, redirectIfAuthenticated, showSignup)
  .post(handleSignup);

router
  .route("/verify-otp")
  .get(noCache, requireOtpSession, showVerifyOTP)
  .post(verifyOTP);

router
  .route("/login")
  .get(noCache, redirectIfAuthenticated, showLogin)
  .post(handleLogin);

router.post("/resend-otp", resendOTP);

router.post("/logout", noCache, logout);

//Forgot Password

router
  .route("/forgot-password")
  .get(noCache, showForgotPassword)
  .post(handleForgotPassword);

router
  .route("/reset-password")
  .get(noCache, showResetPassword)
  .post(handleResetPassword);

// Profile

router.get("/profile", noCache, requireAuth, showProfile);

router
  .route("/profile/edit")
  .get(requireAuth, noCache, showEditProfile)
  .put(requireAuth, updateProfile);

//Profile Photo upload and Remove

router.post("/profile/upload-photo", requireAuth, upload.single("profileImage"), uploadProfilePhoto);
router.delete("/profile/remove-photo", requireAuth, removeProfilePhoto);

// Change Email

router.get("/profile/change-email", noCache, requireAuth, showChangeEmail);
router.post("/profile/change-email", requireAuth, requestEmailChange);

router.get("/profile/verify-email-change",noCache,requireAuth, showVerifyEmailChangeOTP );
router.post("/profile/verify-email-change", requireAuth, verifyEmailChangeOTP);

// Resend email change otp

router.post("/profile/resend-email-change-otp",requireAuth,resendEmailChangeOTP );

// Change Password Authenticated

router.get("/profile/change-password", noCache, requireAuth, showChangePassword);
router.post("/profile/change-password", noCache, requireAuth, handleChangePassword);

router.get("/forgot-password/authenticated", handleAuthForgotPassword);

/* Address Management */

router.get("/addresses", noCache, requireAuth, showAddressManagement);
router.post("/addresses/add", requireAuth, addAddress);
router.put("/addresses/:addressId", requireAuth, updateAddress);
router.delete("/addresses/:addressId", requireAuth, deleteAddress);
router.get("/pincode/:code",getPincodeDetails);

// Product Listing page

router.get("/shop",getProducts);
router.get("/product/:slug", getProductDetails);

// Cart
router.get("/cart",requireAuth,getCart);
router.post("/cart/add",requireAuth,addToCart);
router.patch("/cart/update-quantity",requireAuth,updateCartItemQuantity);
router.delete("/cart/remove/:inventoryId", requireAuth, removeCartItem);
router.delete("/cart/clear", requireAuth, clearCart);

// Checkout
router.get("/checkout",requireAuth,noCache,getCheckoutPage);
router.post("/apply-coupon",requireAuth,applyCoupon);
router.post('/remove-coupon',requireAuth,removeCoupon);
router.post("/place-order".requireAuth,placeOrder);

// Order 
router.get("/order-success/:orderId",requireAuth,getOrderSuccess);
router.get("/orders/:orderId",requireAuth, noCache, getOrderDetails);
router.get("/orders",requireAuth, noCache ,getUserOrders);

// Cancel and Returns
router.post("/orders/:orderId/items/:itemId/cancel",requireAuth,cancelItem);
router.post("/orders/:orderId/cancel",requireAuth,cancelEntireOrder);
router.post("/orders/:orderId/items/:itemId/return",upload.array("images",3),requireAuth,requestReturn);
router.post("/orders/:orderId/return",requireAuth,requestReturnEntireOrder);

// Invoice download
router.get("/orders/:orderId/invoice",requireAuth,downloadInvoice);

// Wallet
router.get("/wallet",requireAuth, noCache ,getWalletPage);
router.post("/wallet/create-topup",requireAuth,createWalletTopup);
router.post("/wallet/verify-topup",requireAuth,verifyWalletTopup);

// Wishlist
router.get("/wishlist",requireAuth, noCache, getWishlistPage);
router.post("/wishlist/add",requireAuth,addToWishlist);
router.delete("/wishlist/remove",requireAuth, removeFromWishlist);
router.get("/wishlist/variant/:variantId/sizes",requireAuth,getVariantSizes);

// RazorPay
router.post("/razorpay/create-order", requireAuth, createRazorpayPaymentOrder);
router.post("/razorpay/verify", requireAuth, verifyRazorpayPayment);
router.get("/payment-failed/:orderId", requireAuth, getPaymentFailedPage);

// Refer and Earn 
router.get("/refer",requireAuth, noCache, getReferralPage);
export default router;
