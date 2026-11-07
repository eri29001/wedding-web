import { Router } from 'express';
import { getAuditHistory } from '../controllers/auditController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/history', verifyToken, getAuditHistory);

export default router;