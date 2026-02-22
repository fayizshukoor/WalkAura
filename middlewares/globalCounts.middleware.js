import Cart from "../models/Cart.model.js";
import Wishlist from "../models/Wishlist.model.js";

export const getGlobalCounts = async (req, res, next) => {
  res.locals.cartCount = 0;
  res.locals.wishlistCount = 0;

  if (req.user && req.user.userId) {
    try {
      const userId = req.user.userId;

      const [cart, wishlist] = await Promise.all([
        Cart.findOne({ user: userId }).select("totalItems").lean(),
        Wishlist.findOne({ user: userId }).select("items").lean(),
      ]);

      res.locals.cartCount = cart ? cart.totalItems : 0;
      res.locals.wishlistCount = wishlist ? wishlist.items.length : 0;

    } catch (error) {
      console.error("Global count error:", error);
      res.locals.cartCount = 0;
      res.locals.wishlistCount = 0;
    }
  }

  next();
};