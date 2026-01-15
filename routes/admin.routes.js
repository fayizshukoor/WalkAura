import express from "express";

// Controller imports

import {
  adminLogout,
  handleAdminLogin,
  showAdminLogin,
} from "../controllers/admin/auth.controller.js";
import { showAdminDashboard } from "../controllers/admin/dashboard.controller.js";
import {
  showCustomers,
  toggleCustomerStatus,
} from "../controllers/admin/customers.controller.js";


import { addCategory, editCategory, getCategoriesAjax, showCategories, toggleCategoryStatus } from "../controllers/admin/categories.controller.js";

import { addProduct, getProductsAjax, showAddProduct, showProducts, toggleProductStatus } from "../controllers/admin/product.controller.js";


// middleware imports
import { redirectIfAdminAuthenticated, requireAdmin } from "../middlewares/admin.middleware.js";
import { noCache } from "../middlewares/cache.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.get("/", noCache, redirectIfAdminAuthenticated, showAdminLogin);
router.post("/login", handleAdminLogin);

router.use(requireAdmin);
router.get("/logout", noCache,adminLogout);

router.get("/dashboard", noCache, showAdminDashboard);

// Customers
router.get("/customers", noCache, showCustomers);
router.patch("/customers/:id/toggle-status", toggleCustomerStatus);

// Categories
router.get("/categories",showCategories);
router.get("/categories/data",getCategoriesAjax);
router.post("/categories/add",addCategory);
router.patch("/categories/edit/:id",editCategory);
router.patch("/categories/toggle/:id",toggleCategoryStatus);

//Products

router.get("/products",showProducts);
router.get("/products/data",getProductsAjax);
router.get("/products/add",showAddProduct);
router.post("/products/add",upload.array("productImages",4),addProduct);
router.patch("/products/toggle/:id",toggleProductStatus);
export default router;
