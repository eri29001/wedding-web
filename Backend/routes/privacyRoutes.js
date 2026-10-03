import { Router } from 'express';
import { exportUserData, requestDataDeletion } from '../controllers/privacyController.js';

const router = Router();

router.get('/privacy/export/:userId', exportUserData);
router.post('/privacy/delete-account', requestDataDeletion);

export default router;