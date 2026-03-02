import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";

const router = Router();

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get Current User
 *     description: Returns information about the currently authenticated user.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     picture:
 *                       type: string
 *       401:
 *         description: Invalid session
 */
router.get("/me", asyncHandler(async (req, res) => {
  if (!req.session?.token) {
    return res.json({ authenticated: false });
  }

  if (req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user,
    });
  } else {
    res.json({ authenticated: true });
  }
}));

export default router;
