import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3127';

// Helper function to generate JWT token
const generateToken = (user: any) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' } as any
  );
};

// Google OAuth routes
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const user = req.user as any;
    const token = generateToken(user);
    
    // Redirect to frontend with token
    res.redirect(`${CLIENT_URL}/login?token=${token}&provider=google`);
  }
);

// LinkedIn OAuth routes
router.get('/linkedin', passport.authenticate('linkedin'));

router.get('/linkedin/callback',
  passport.authenticate('linkedin', { failureRedirect: `${CLIENT_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const user = req.user as any;
    const token = generateToken(user);
    
    // Redirect to frontend with token
    res.redirect(`${CLIENT_URL}/login?token=${token}&provider=linkedin`);
  }
);

// GitHub OAuth routes
router.get('/github', passport.authenticate('github', {
  scope: ['user:email']
}));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: `${CLIENT_URL}/login?error=oauth_failed` }),
  (req, res) => {
    const user = req.user as any;
    const token = generateToken(user);
    
    // Redirect to frontend with token
    res.redirect(`${CLIENT_URL}/login?token=${token}&provider=github`);
  }
);

// Logout route
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    return res.json({ message: 'Logged out successfully' });
  });
});

export { router as authRoutes };