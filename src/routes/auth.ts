import { Router, Request, Response } from 'express';
import { register, login } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);

router.get('/profile', authenticateToken, (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Profile retrieved successfully',
    user: req.user,
  });
});

export default router;
