import { Router } from 'express';
import { getChecklist, createChecklist, updateChecklist, deleteChecklist } from '../controllers/checklistController.js';

const router = Router();

router.get('/checklist/:userId', getChecklist);
router.post('/checklist', createChecklist);
router.patch('/checklist/:id', updateChecklist);
router.delete('/checklist/:id', deleteChecklist);

export default router;