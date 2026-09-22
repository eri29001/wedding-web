import { Router } from 'express';
import { login, register, forgotPassword } from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);

export default router;