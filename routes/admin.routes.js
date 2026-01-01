import express from "express";
import { adminLogout, handleAdminLogin, showAdminLogin } from "../controllers/admin/auth.controller.js";
import { showAdminDashboard } from "../controllers/admin/dashboard.controller.js";
import { requireAdmin } from "../middlewares/requireAdmin.middleware.js";
import { showCustomers, toggleCustomerStatus } from "../controllers/admin/customers.controller.js";

const router = express.Router();


router.get("/",showAdminLogin);
router.post("/login", handleAdminLogin);

router.use(requireAdmin);
router.get("/logout", adminLogout);

router.get("/dashboard", showAdminDashboard);

router.get("/customers", showCustomers);
router.post("/customers/:id/toggle-status", toggleCustomerStatus);

export default router;


