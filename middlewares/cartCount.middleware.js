import Cart from "../models/Cart.model.js";

export const getCartCount = async (req, res, next) => {
  // Initialize cartCount
  res.locals.cartCount = 0;

  // Only fetch if user is logged in
  if (req.user && req.user.userId) {
    try {
      const cart = await Cart.findOne({ user: req.user.userId }).select('totalItems');
      res.locals.cartCount = cart ? cart.totalItems : 0;
    } catch (error) {
      console.error('Cart count error:', error);
      res.locals.cartCount = 0;
    }
  }

  next();
};