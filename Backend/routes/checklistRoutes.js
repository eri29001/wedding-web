import { Router } from 'express';
import { 
    getChecklist, 
    createChecklist, 
    updateChecklist, 
    deleteChecklist 
} from '../controllers/checklistController.js';
import { verifyToken, verifyReadOnlyMode } from '../middleware/authMiddleware.js';

const router = Router();

// Consultar tareas (permite lectura aunque el evento esté en modo solo lectura)
router.get('/', verifyToken, getChecklist);

// Operaciones de modificación (bloqueadas si el evento pasó a estado Completada / Cancelada)
router.post('/', verifyToken, verifyReadOnlyMode, createChecklist);
router.patch('/:id', verifyToken, verifyReadOnlyMode, updateChecklist);
router.delete('/:id', verifyToken, verifyReadOnlyMode, deleteChecklist);

export default router;