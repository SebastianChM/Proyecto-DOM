import { Router } from 'express';
import { apsAuthService } from '../services/aps/auth.service';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';

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
// Login endpoint - Redirects to APS login
router.get('/login', (req, res) => {
    const url = apsAuthService.getAuthorizationUrl();
    res.redirect(url);
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
// Callback endpoint - Handles APS response
router.get('/callback', async (req, res) => {
    const debugLogPath = path.join(process.cwd(), 'auth_callback_debug.txt');
    fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] Callback hit with code: ${req.query.code ? 'YES' : 'NO'}\n`);

    try {
        const code = req.query.code as string;
        if (!code) {
            throw new Error('No code provided');
        }

        const credentials = await apsAuthService.getPublicToken(code);

        const debugPath = path.join(process.cwd(), 'auth_callback_debug.txt');
        fs.appendFileSync(debugPath, `[${new Date().toISOString()}] Token received. Scope: ${credentials.scope}\n`);

        // Try to get user profile, but don't fail if it returns 403
        let profile: any = null;
        try {
            profile = await apsAuthService.getUserProfile(credentials.access_token);

            // DEBUG: Capture the exact profile data to a file for inspection
            try {
                fs.appendFileSync(debugPath, `[${new Date().toISOString()}] [ROUTE] Profile received: ${JSON.stringify(profile)}\n`);
            } catch (err) {
                console.error('Failed to write debug profile:', err);
            }

            // Validate profile structure
            // Note: Autodesk User Profile API v1 returns 'emailId', but OIDC compliant endpoints return 'email'
            // We check for both to be safe.
            const email = profile.email || profile.emailId;

            if (!profile || !email) {
                fs.appendFileSync(debugPath, `[${new Date().toISOString()}] [ROUTE] WARNING: Profile incomplete (missing email)\n`);
                console.warn('Received incomplete profile:', JSON.stringify(profile));
                throw new Error('Profile missing email');
            }

            // Normalize profile data
            profile.emailId = email;
            profile.firstName = profile.given_name || profile.firstName;
            profile.lastName = profile.family_name || profile.lastName;
            profile.userId = profile.sub || profile.userId; // 'sub' is the standard OIDC user ID

        } catch (profileError: any) {
            fs.appendFileSync(debugPath, `[${new Date().toISOString()}] [ROUTE] ERROR fetching profile: ${JSON.stringify(profileError)}\n`);
            console.error('CRITICAL: Could not fetch user profile. Error details:', profileError);

            // Fallback
            profile = {
                emailId: 'user@autodesk.com',
                firstName: 'Autodesk',
                lastName: 'User',
                userId: 'aps-user-' + Date.now()
            };
        }

        // Robust name extraction (handles firstName/givenName variations)
        const firstName = profile.firstName || profile.givenName || 'Autodesk';
        const lastName = profile.lastName || profile.familyName || 'User';
        const fullName = `${firstName} ${lastName}`;

        // Create or update user in local DB
        const user = await prisma.user.upsert({
            where: { email: profile.emailId },
            update: {
                name: fullName,
                apsUserId: profile.userId || 'unknown',
            },
            create: {
                email: profile.emailId,
                name: fullName,
                apsUserId: profile.userId || 'unknown',
                role: 'USER'
            }
        });

        // Store tokens and user info in session
        if (req.session) {
            req.session.token = credentials.access_token;
            req.session.refreshToken = credentials.refresh_token;
            req.session.expiresAt = Date.now() + (credentials.expires_in * 1000);

            // Handle different picture formats (SDK vs OIDC)
            let pictureUrl = '';
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
                picture: pictureUrl
            };
        }

        res.redirect('http://localhost:3000/dashboard'); // Redirect to frontend dashboard
    } catch (error: any) {
        console.error('Callback error:', error);
        res.status(500).json({ error: 'Authentication failed', details: error.message });
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
// Get viewer token - Returns a public read-only token for the viewer
router.get('/token', async (req, res) => {
    try {
        const credentials = await apsAuthService.getViewerToken();
        res.json(credentials);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get viewer token' });
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
// Get user token - Returns the 3-legged token from session (for viewing ACC/BIM 360 files)
router.get('/user-token', (req, res) => {
    if (req.session && req.session.token) {
        res.json({ access_token: req.session.token });
    } else {
        res.status(401).json({ error: 'No user token available' });
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
// Logout endpoint
router.post('/logout', (req, res) => {
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
// Get current user info
router.get('/me', async (req, res) => {
    if (!req.session?.token) {
        return res.json({ authenticated: false });
    }

    try {
        // Return session info
        if (req.session.user) {
            res.json({
                authenticated: true,
                user: req.session.user
            });
        } else {
            // Fallback if session exists but no user info
            res.json({ authenticated: true });
        }
    } catch (error) {
        res.status(401).json({ error: 'Invalid session' });
    }
});

export default router;
