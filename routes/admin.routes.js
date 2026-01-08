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


import { addCategory, editCategory, getCategoriesData, showCategories, toggleCategoryStatus } from "../controllers/admin/categories.controller.js";


// middleware imports
import { redirectIfAdminAuthenticated, requireAdmin } from "../middlewares/admin.middleware.js";
import { noCache } from "../middlewares/cache.middleware.js";

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
router.get("/categories/data",getCategoriesData);
router.post("/categories/add",addCategory);
router.patch("/categories/edit/:id",editCategory);
router.patch("/categories/toggle/:id",toggleCategoryStatus);


export default router;
