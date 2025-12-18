import { Router } from 'express';
import { apsAuthService } from '../services/aps/auth.service';
import prisma from '../lib/prisma';

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
    try {
        let url = apsAuthService.getAuthorizationUrl();

        // Check if force login is requested (to switch accounts)
        if (req.query.prompt === 'login' || req.query.force === 'true') {
            url += '&prompt=login';
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('Redirecting to Autodesk Login URL:', url);
        }
        res.redirect(url);
    } catch (error: any) {
        console.error('Failed to generate Autodesk login URL:', error);

        const frontendUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        // Redirect to our new error page
        res.redirect(`${frontendUrl}/auth/error?error=generation_failed&details=${encodeURIComponent(error.message)}`);
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
// Callback endpoint - Handles APS response
router.get('/callback', async (req, res) => {
    try {
        const error = req.query.error;
        const code = req.query.code as string;

        // Handle errors or user cancellation
        if (error) {
            console.warn('Auth callback error:', error, req.query.error_description);
            // If user cancelled (access_denied), redirect gracefully
            const redirectUrl = process.env.NEXTAUTH_URL
                ? `${process.env.NEXTAUTH_URL}/api/auth/login?error=${error}`
                : (process.env.NODE_ENV !== 'production' ? `http://localhost:3000/api/auth/login?error=${error}` : '/');

            // Ideally redirect to a frontend page that shows the error, typically /login
            // But we don't have a dedicated /login page on frontend (it redirects to API login).
            // We should redirect to the ROOT page with an error query param if possible?
            // User requested: "Cancel" -> "allow trying another account".
            // So we redirect them to the "authorize" page again? Or a page where they can click "Login" again.
            // Since our /login endpoint REDIRECTS to Autodesk, redirecting to /login creates a loop if we are not careful.

            // Redirect to Frontend Root
            const frontendUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}?error=auth_cancelled`);
        }

        if (!code) {
            const frontendUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}?error=no_code`);
        }

        const credentials = await apsAuthService.getPublicToken(code);

        // Try to get user profile, but don't fail if it returns 403
        let profile: any = null;
        try {
            profile = await apsAuthService.getUserProfile(credentials.access_token);

            // Validate profile structure
            // Note: Autodesk User Profile API v1 returns 'emailId', but OIDC compliant endpoints return 'email'
            // We check for both to be safe.
            const email = profile.email || profile.emailId;

            if (!profile || !email) {
                console.warn('Received incomplete profile:', JSON.stringify(profile));
                throw new Error('Profile missing email');
            }

            // Normalize profile data
            profile.emailId = email;
            profile.firstName = profile.given_name || profile.firstName;
            profile.lastName = profile.family_name || profile.lastName;
            profile.userId = profile.sub || profile.userId; // 'sub' is the standard OIDC user ID

        } catch (profileError: any) {
            console.error('CRITICAL: Could not fetch user profile. Error details:', profileError);

            // In production, fail authentication if profile cannot be fetched
            if (process.env.NODE_ENV === 'production') {
                throw new Error('Authentication failed: Unable to retrieve user profile');
            }

            // Only use fallback in development for testing
            profile = {
                emailId: 'dev-user@localhost.com',
                firstName: 'Dev',
                lastName: 'User',
                userId: 'dev-user-' + Date.now()
            };
        }

        // Robust name extraction (handles firstName/givenName variations)
        const firstName = profile.firstName || profile.givenName || 'Autodesk';
        const lastName = profile.lastName || profile.familyName || 'User';
        const fullName = `${firstName} ${lastName}`;

        // Determinar rol basado en lista de admins
        const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
        const isAdmin = adminEmails.includes(profile.emailId.toLowerCase());

        // Create or update user in local DB
        const user = await prisma.user.upsert({
            where: { email: profile.emailId },
            update: {
                name: fullName,
                apsUserId: profile.userId || 'unknown',
                role: isAdmin ? 'ADMIN' : 'USER' // Actualizar rol si cambió
            },
            create: {
                email: profile.emailId,
                name: fullName,
                apsUserId: profile.userId || 'unknown',
                role: isAdmin ? 'ADMIN' : 'USER'
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

            if (process.env.NODE_ENV !== 'production') {
                console.log('[DEBUG] Auth Callback: Session saved', {
                    user: req.session.user.email,
                    hasToken: !!req.session.token
                });
            }
        }

        const redirectUrl = process.env.NEXTAUTH_URL
            ? `${process.env.NEXTAUTH_URL}/dashboard`
            : (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000/dashboard' : '/dashboard');
        res.redirect(redirectUrl);
    } catch (error: any) {
        console.error('Callback error:', error);
        // Redirect to frontend with error message
        const frontendUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}?error=auth_failed&details=${encodeURIComponent(error.message)}`);
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

// Dev login endpoint - Bypass for debugging
router.get('/dev-login', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).send('Not Found');
    }

    if (req.session) {
        req.session.token = 'mock-token';
        req.session.refreshToken = 'mock-refresh-token';
        req.session.expiresAt = Date.now() + 3600000;
        req.session.user = {
            id: 'cf2dd72f-7e84-45f2-b225-876510a57b10', // Real Admin ID from DB
            name: 'Sebastián Chirino',
            email: 'sebastian.chirino@dom.com',
            role: 'ADMIN',
            picture: ''
        };
    }
    const redirectUrl = process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/dashboard` : 'http://localhost:3000/dashboard';
    res.redirect(redirectUrl);
});

export default router;
