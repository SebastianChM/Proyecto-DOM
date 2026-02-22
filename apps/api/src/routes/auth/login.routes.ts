import { Router } from "express";
import { apsAuthService } from "../../services/aps/auth.service";
import prisma from "../../lib/prisma";
import { env } from "../../config/env";
import { CONSTANTS } from "../../config/constants";
import { getFrontendUrl, getDashboardUrl } from "../../lib/utils";
import { logger } from "../../lib/logger";

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
      logger.debug("[AUTH] Redirecting to Autodesk Login", { url });
    }
    res.redirect(url);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[AUTH] Failed to generate Autodesk login URL", {
      error: msg,
    });

    const frontendUrl = getFrontendUrl();
    res.redirect(
      `${frontendUrl}${CONSTANTS.FRONTEND.AUTH_ERROR_PATH}?error=generation_failed&details=${encodeURIComponent(msg)}`,
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
      logger.warn("[AUTH] Callback error", {
        error,
        description: req.query.error_description,
      });
      const frontendUrl = getFrontendUrl();
      return res.redirect(`${frontendUrl}?error=auth_cancelled`);
    }

    if (!code) {
      const frontendUrl = getFrontendUrl();
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
        logger.warn("[AUTH] Received incomplete profile", {
          hasEmail: !!email,
          hasProfile: !!profile,
        });
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
      logger.error("[AUTH] Could not fetch user profile", { error: msg });

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
      logger.info("[AUDIT] Role changed", {
        email: user.email,
        from: previousRole,
        to: user.role,
      });
    } else if (!previousRole && user.role === "ADMIN") {
      logger.info("[AUDIT] New ADMIN user created", { email: user.email });
    }

    // Log auth callback success
    logger.info("[AUTH] Callback success", {
      email: user.email,
      role: user.role,
    });

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
        const sessionSize = JSON.stringify(req.session).length;
        logger.debug("[AUTH] Auth Callback", {
          user: req.session.user.email,
          hasToken: !!req.session.token,
          sessionSizeBytes: sessionSize,
          isOverLimit: sessionSize > CONSTANTS.SESSION.MAX_COOKIE_SIZE_BYTES,
        });
        if (sessionSize > CONSTANTS.SESSION.MAX_COOKIE_SIZE_BYTES) {
          logger.error("[AUTH] Session size exceeds 4KB cookie limit!");
        }
      }
    }

    const redirectUrl = getDashboardUrl();

    logger.debug("[AUTH] Saving session before redirect...");
    req.session.save((err) => {
      if (err) {
        logger.error("[AUTH] Session save error", { error: String(err) });
        const frontendUrl = getFrontendUrl();
        return res.redirect(
          `${frontendUrl}?error=session_save_failed&details=${encodeURIComponent(String(err))}`,
        );
      }
      res.redirect(redirectUrl);
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[AUTH] Callback error", { error: msg });
    const frontendUrl = getFrontendUrl();
    res.redirect(
      `${frontendUrl}?error=auth_failed&details=${encodeURIComponent(msg)}`,
    );
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
  req.session.destroy((err) => {
    if (err) {
      logger.error("[AUTH] Logout error", { error: String(err) });
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("dom-session"); // Clear the cookie explicitly
    res.json({ success: true });
  });
});

// Dev login endpoint - Only available in development
router.get("/dev-login", (req, res) => {
  if (env.NODE_ENV === "production") {
    return res.status(404).send("Not Found");
  }

  req.session.token = "mock-token";
  req.session.refreshToken = "mock-refresh-token";
  req.session.expiresAt = Date.now() + CONSTANTS.SESSION.ONE_HOUR_MS;
  req.session.user = {
    id: "cf2dd72f-7e84-45f2-b225-876510a57b10",
    name: "Dev User",
    email: "dev-user@localhost.com",
    role: "ADMIN",
    picture: "",
  };

  const redirectUrl = getDashboardUrl();

  logger.debug("[AUTH] Saving dev session before redirect...");
  req.session.save((err) => {
    if (err) {
      logger.error("[AUTH] Dev session save error", { error: String(err) });
      return res
        .status(500)
        .send(
          `Session save failed: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
    logger.debug("[AUTH] Dev session saved, redirecting", { redirectUrl });
    res.redirect(redirectUrl);
  });
});

export default router;
