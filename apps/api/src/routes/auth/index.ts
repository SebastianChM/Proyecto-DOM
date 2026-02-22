import { Router } from "express";
import loginRoutes from "./login.routes";
import tokenRoutes from "./token.routes";
import userRoutes from "./user.routes";

const router = Router();

// Mount routes
router.use("/", loginRoutes);
router.use("/", tokenRoutes);
router.use("/", userRoutes);

export default router;
