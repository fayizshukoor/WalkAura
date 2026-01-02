import express from "express";
import { adminLogout, handleAdminLogin, showAdminLogin } from "../controllers/admin/auth.controller.js";
import { showAdminDashboard } from "../controllers/admin/dashboard.controller.js";
import { requireAdmin } from "../middlewares/requireAdmin.middleware.js";
import { showCustomers, toggleCustomerStatus } from "../controllers/admin/customers.controller.js";
import { noCache, redirectIfAdminAuthenticated } from "../middlewares/auth.middleware.js";

const router = express.Router();


router.get("/",noCache,redirectIfAdminAuthenticated, showAdminLogin);
router.post("/login", handleAdminLogin);

router.use(requireAdmin);
router.get("/logout", adminLogout);

router.get("/dashboard",noCache, showAdminDashboard);

router.get("/customers",noCache, showCustomers);
router.post("/customers/:id/toggle-status", toggleCustomerStatus);

export default router;


