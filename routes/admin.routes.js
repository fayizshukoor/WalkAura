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

// middleware imports
import { redirectIfAdminAuthenticated, requireAdmin } from "../middlewares/admin.middleware.js";
import { noCache } from "../middlewares/cache.middleware.js";

const router = express.Router();

router.get("/", noCache, redirectIfAdminAuthenticated, showAdminLogin);
router.post("/login", handleAdminLogin);

router.use(requireAdmin);
router.get("/logout", noCache,adminLogout);

router.get("/dashboard", noCache, showAdminDashboard);

router.get("/customers", noCache, showCustomers);
router.post("/customers/:id/toggle-status", toggleCustomerStatus);

export default router;
