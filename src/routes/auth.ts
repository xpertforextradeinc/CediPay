import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected route example - get current user profile
router.get('/profile', authenticateToken, (req, res) => {
  res.status(200).json({
    message: 'Profile retrieved successfully',
    user: req.user,
  });
});

export default router;