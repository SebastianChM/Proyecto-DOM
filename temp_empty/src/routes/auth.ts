import { Router } from "express";
import { apsAuthService } from "../services/aps/auth.service";
import prisma from "../lib/prisma";
import { env } from "../config/env";

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   get:
 *     summary: Initiate APS authentication
 *     description: Redirects the user to the Autodesk Platform Services login page.
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirects to Autodesk login
 */
router.get("/login", (req, res) => {
  try {
    let url = apsAuthService.getAuthorizationUrl();

    // Check if force login is requested (to switch accounts)
    if (req.query.prompt === "login" || req.query.force === "true") {
      url += "&prompt=login";
    }

    if (env.NODE_ENV !== "production") {
      console.log("Redirecting to Autodesk Login URL:", url);
    }
    res.redirect(url);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to generate Autodesk login URL:", msg);

    const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    res.redirect(
      `${frontendUrl}/auth/error?error=generation_failed&details=${encodeURIComponent(msg)}`,
    );
  }
});

/**
 * @swagger
 * /auth/callback:
 *   get:
 *     summary: APS Authentication Callback
 *     description: Handles the callback from Autodesk Platform Services after login.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: The authorization code returned by APS
 *     responses:
 *       302:
 *         description: Redirects to the dashboard on success
 *       500:
 *         description: Authentication failed
 */
router.get("/callback", async (req, res) => {
  try {
    const error = req.query.error;
    const code = req.query.code as string;

    // Handle errors or user cancellation
    if (error) {
      console.warn("Auth callback error:", error, req.query.error_description);
      const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}?error=auth_cancelled`);
    }

    if (!code) {
      const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}?error=no_code`);
    }

    const credentials = await apsAuthService.getPublicToken(code);

    // Try to get user profile
    let profile: {
      email?: string;
      emailId?: string;
      firstName?: string;
      lastName?: string;
      given_name?: string;
      family_name?: string;
      userId?: string;
      sub?: string;
      picture?: string;
      profileImages?: { sizeX40?: string };
      thumbnails?: { sizeX40?: string };
      givenName?: string;
      familyName?: string;
    } | null = null;

    try {
      profile = await apsAuthService.getUserProfile(credentials.access_token);

      const email = profile?.email || profile?.emailId;

      if (!profile || !email) {
        console.warn(
          "Received incomplete profile:",
          JSON.stringify({
            hasEmail: !!email,
            hasProfile: !!profile,
          }),
        );
        throw new Error("Profile missing email");
      }

      // Normalize profile data
      profile.emailId = email;
      profile.firstName = profile.given_name || profile.firstName;
      profile.lastName = profile.family_name || profile.lastName;
      profile.userId = profile.sub || profile.userId;
    } catch (profileError: unknown) {
      const msg =
        profileError instanceof Error
          ? profileError.message
          : String(profileError);
      console.error(
        "CRITICAL: Could not fetch user profile. Error details:",
        msg,
      );

      // In production, fail authentication if profile cannot be fetched
      if (env.NODE_ENV === "production") {
        throw new Error(
          "Authentication failed: Unable to retrieve user profile",
        );
      }

      // Only use fallback in development for testing
      profile = {
        emailId: "dev-user@localhost.com",
        firstName: "Dev",
        lastName: "User",
        userId: "dev-user-" + Date.now(),
      };
    }

    // Robust name extraction
    const firstName = profile.firstName || profile.givenName || "Autodesk";
    const lastName = profile.lastName || profile.familyName || "User";
    const fullName = `${firstName} ${lastName}`;

    // Determine role based on admin emails list (pre-parsed from env)
    const isAdmin = env.adminEmails.includes(
      (profile.emailId || "").toLowerCase(),
    );

    // Check existing user for role change detection
    const existingUser = await prisma.user.findUnique({
      where: { email: profile.emailId },
    });
    const previousRole = existingUser?.role;

    // Create or update user in local DB
    const user = await prisma.user.upsert({
      where: { email: profile.emailId },
      update: {
        name: fullName,
        apsUserId: profile.userId || "unknown",
        role: isAdmin ? "ADMIN" : "USER",
      },
      create: {
        email: profile.emailId!,
        name: fullName,
        apsUserId: profile.userId || "unknown",
        role: isAdmin ? "ADMIN" : "USER",
      },
    });

    // Log role changes for audit
    if (previousRole && previousRole !== user.role) {
      console.log(
        `🔐 [AUDIT] Role changed for ${user.email}: ${previousRole} → ${user.role}`,
      );
    } else if (!previousRole && user.role === "ADMIN") {
      console.log(`🔐 [AUDIT] New ADMIN user created: ${user.email}`);
    }

    // Log auth callback success
    console.log(
      `✅ [AUTH] Callback success for ${user.email} (role: ${user.role})`,
    );

    // Store tokens and user info in session
    if (req.session) {
      req.session.token = credentials.access_token;
      req.session.refreshToken = credentials.refresh_token;
      req.session.expiresAt = Date.now() + credentials.expires_in * 1000;

      // Handle different picture formats
      let pictureUrl = "";
      if (profile.picture) {
        pictureUrl = profile.picture;
      } else if (profile.profileImages?.sizeX40) {
        pictureUrl = profile.profileImages.sizeX40;
      } else if (profile.thumbnails?.sizeX40) {
        pictureUrl = profile.thumbnails.sizeX40;
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: pictureUrl,
      };

      if (env.NODE_ENV !== "production") {
        console.log("[DEBUG] Auth Callback: Session saved", {
          user: req.session.user.email,
          hasToken: !!req.session.token,
        });
      }
    }

    const redirectUrl = process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/dashboard`
      : env.NODE_ENV !== "production"
        ? "http://localhost:3000/dashboard"
        : "/dashboard";
    res.redirect(redirectUrl);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ [AUTH] Callback error:", msg);
    const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    res.redirect(
      `${frontendUrl}?error=auth_failed&details=${encodeURIComponent(msg)}`,
    );
  }
});

/**
 * @swagger
 * /auth/token:
 *   get:
 *     summary: Get Viewer Token
 *     description: Returns a public read-only token for the viewer.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Viewer token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *       500:
 *         description: Failed to get viewer token
 */
router.get("/token", async (req, res) => {
  try {
    const credentials = await apsAuthService.getViewerToken();
    res.json(credentials);
  } catch {
    res.status(500).json({ error: "Failed to get viewer token" });
  }
});

/**
 * @swagger
 * /auth/user-token:
 *   get:
 *     summary: Get User Token
 *     description: Returns the 3-legged token from the session.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *       401:
 *         description: No user token available
 */
router.get("/user-token", (req, res) => {
  if (req.session && req.session.token) {
    res.json({ access_token: req.session.token });
  } else {
    res.status(401).json({ error: "No user token available" });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout
 *     description: Clears the user session.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

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
router.get("/me", async (req, res) => {
  if (!req.session?.token) {
    return res.json({ authenticated: false });
  }

  try {
    if (req.session.user) {
      res.json({
        authenticated: true,
        user: req.session.user,
      });
    } else {
      res.json({ authenticated: true });
    }
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
});

// Dev login endpoint - Only available in development
router.get("/dev-login", (req, res) => {
  if (env.NODE_ENV === "production") {
    return res.status(404).send("Not Found");
  }

  if (req.session) {
    req.session.token = "mock-token";
    req.session.refreshToken = "mock-refresh-token";
    req.session.expiresAt = Date.now() + 3600000;
    req.session.user = {
      id: "cf2dd72f-7e84-45f2-b225-876510a57b10",
      name: "Dev User",
      email: "dev-user@localhost.com",
      role: "ADMIN",
      picture: "",
    };
  }
  const redirectUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/dashboard`
    : "http://localhost:3000/dashboard";
  res.redirect(redirectUrl);
});

export default router;
