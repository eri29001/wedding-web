import { Router } from 'express';
import { 
    getTables, 
    createTable, 
    assignSeat, 
    addDietaryRestriction, 
    getDietaryReport 
} from '../controllers/seatingController.js';
import { verifyToken, verifyReadOnlyMode } from '../middleware/authMiddleware.js';

const router = Router();

// Consultas
router.get('/tables', verifyToken, getTables);
router.get('/dietary-report', verifyToken, getDietaryReport);

// Operaciones de modificación (protegidas con el modo solo lectura tras el cierre)
router.post('/tables', verifyToken, verifyReadOnlyMode, createTable);
router.post('/assign-seat', verifyToken, verifyReadOnlyMode, assignSeat);
router.post('/dietary', verifyToken, verifyReadOnlyMode, addDietaryRestriction);

export default router;