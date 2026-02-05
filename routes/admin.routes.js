import express from "express";

// Controller imports

import { adminLogout,handleAdminLogin,showAdminLogin } from "../controllers/admin/auth.controller.js";

import { showAdminDashboard } from "../controllers/admin/dashboard.controller.js";

import { showCustomers,toggleCustomerStatus } from "../controllers/admin/customers.controller.js";


import { addCategory, editCategory, getCategoriesAjax, showCategories, softDeleteCategory, toggleCategoryStatus } from "../controllers/admin/categories.controller.js";

import { addProduct, editProduct, getProductFullDetails, getProductsAjax, showAddProduct, showEditProduct, showProducts, toggleProductStatus } from "../controllers/admin/product.controller.js";

import { addVariant, showManageVariants, toggleVariantStatus, updateVariant } from "../controllers/admin/variant.controller.js";

import { getAllOrders } from "../controllers/admin/order.controller.js";


// middleware imports
import { redirectIfAdminAuthenticated, requireAdmin } from "../middlewares/admin.middleware.js";
import { noCache } from "../middlewares/cache.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();



router.get("/", redirectIfAdminAuthenticated, showAdminLogin);
router.post("/login", handleAdminLogin);

router.use(requireAdmin,noCache);

router.post("/logout",adminLogout);

router.get("/dashboard", showAdminDashboard);

// Customers
router.get("/customers", showCustomers);
router.patch("/customers/:id/toggle-status", toggleCustomerStatus);

// Categories
router.get("/categories",showCategories);
router.get("/categories/data",getCategoriesAjax);
router.post("/categories/add",addCategory);
router.patch("/categories/edit/:id",editCategory);
router.patch("/categories/toggle/:id",toggleCategoryStatus);
router.patch("/categories/delete/:id",softDeleteCategory);


//Products

router.get("/products",showProducts);
router.get("/products/data",getProductsAjax);
router.get("/products/add",showAddProduct);
router.post("/products/add",addProduct);
router.get("/products/edit/:id",showEditProduct);
router.patch("/products/edit/:id",upload.array("productImages",4),editProduct);
router.patch("/products/toggle/:id",toggleProductStatus);
router.get("/products/view/:id",getProductFullDetails);

//Variants
router.get("/products/:productId/variants", showManageVariants);
router.post("/products/:productId/variants/add",upload.array("variantImages",4),addVariant);
router.patch("/products/variants/edit/:variantId",upload.array("variantImages",4),updateVariant);
router.patch("/products/variants/toggle/:variantId",toggleVariantStatus);

//Orders
router.get("/orders",getAllOrders);
export default router;
