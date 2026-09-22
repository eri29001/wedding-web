import { Router } from 'express';
import { chatWithIA, generateVows, budgetSimulator } from '../controllers/aiController.js';

const router = Router();

router.post('/ia/chat', chatWithIA);
router.post('/generate-vows', generateVows);
router.post('/budget-simulator', budgetSimulator);

export default router;