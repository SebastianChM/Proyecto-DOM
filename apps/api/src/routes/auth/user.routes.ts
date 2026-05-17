import { Router } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../lib/async-handler";
import { unauthorized } from "../../lib/errors";

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
router.get(
  "/me",
  asyncHandler(async (req, res) => {
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
  }),
);

/**
 * @swagger
 * /auth/me:
 *   patch:
 *     summary: Update current user's display name
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.patch(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.session?.user?.id) {
      throw unauthorized("Authentication required");
    }

    const { name } = req.body as { name?: unknown };

    if (
      typeof name !== "string" ||
      name.trim().length < 1 ||
      name.trim().length > 100
    ) {
      return res
        .status(400)
        .json({ error: "Name must be between 1 and 100 characters" });
    }

    const trimmedName = name.trim();

    const updatedUser = await prisma.user.update({
      where: { id: req.session.user.id },
      data: { name: trimmedName },
      select: { id: true, name: true, email: true, role: true },
    });

    // Reflect the new name in the active session immediately
    req.session.user = {
      ...req.session.user,
      name: updatedUser.name,
    };

    res.json({ success: true, user: updatedUser });
  }),
);

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
router.get(
  "/me",
  asyncHandler(async (req, res) => {
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
  }),
);

export default router;
