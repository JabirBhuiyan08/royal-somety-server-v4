// server/routes/authRoutes.js
import express from 'express';
import { registerUser, getMe, syncUser } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', verifyToken, registerUser);
router.get('/me', verifyToken, getMe);
router.post('/sync', verifyToken, syncUser);

export default router;
