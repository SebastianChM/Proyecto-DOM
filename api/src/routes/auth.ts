import { Router } from 'express';
import { apsAuthService } from '../services/aps/auth.service';
import prisma from '../lib/prisma';

const router = Router();

// Login endpoint - Redirects to APS login
router.get('/login', (req, res) => {
    const url = apsAuthService.getAuthorizationUrl();
    res.redirect(url);
});

// Callback endpoint - Handles APS response
router.get('/callback', async (req, res) => {
    try {
        const code = req.query.code as string;
        if (!code) {
            throw new Error('No code provided');
        }

        const credentials = await apsAuthService.getPublicToken(code);

        // Try to get user profile, but don't fail if it returns 403
        let profile: any = null;
        try {
            profile = await apsAuthService.getUserProfile(credentials.access_token);
        } catch (profileError: any) {
            console.warn('Could not fetch user profile (403 - missing User Profile API permission), using fallback:', profileError.message);
            // Create a minimal profile from available data
            profile = {
                emailId: 'user@autodesk.com', // Fallback email
                firstName: 'Autodesk',
                lastName: 'User',
                userId: 'aps-user-' + Date.now()
            };
        }

        // Create or update user in local DB
        const user = await prisma.user.upsert({
            where: { email: profile.emailId },
            update: {
                name: `${profile.firstName} ${profile.lastName}`,
                apsUserId: profile.userId,
            },
            create: {
                email: profile.emailId,
                name: `${profile.firstName} ${profile.lastName}`,
                apsUserId: profile.userId,
                role: 'USER'
            }
        });

        // Store tokens and user info in session
        if (req.session) {
            req.session.token = credentials.access_token;
            req.session.refreshToken = credentials.refresh_token;
            req.session.expiresAt = Date.now() + (credentials.expires_in * 1000);
            req.session.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                picture: profile.profileImages?.sizeX40 || ''
            };
        }

        res.redirect('http://localhost:3000/dashboard'); // Redirect to frontend dashboard
    } catch (error: any) {
        console.error('Callback error:', error);
        res.status(500).json({ error: 'Authentication failed', details: error.message });
    }
});

// Get viewer token - Returns a public read-only token for the viewer
router.get('/token', async (req, res) => {
    try {
        const credentials = await apsAuthService.getViewerToken();
        res.json(credentials);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get viewer token' });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    req.session = null;
    res.json({ success: true });
});

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
