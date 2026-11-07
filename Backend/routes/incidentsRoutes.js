import { Router } from 'express';
import {
    createIncident,
    respondToIncident,
    resolveIncident,
    getIncidentsByUser,
    getProviderIncidentStats
} from '../controllers/incidentsController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// Consultar incidencias y métricas
router.get('/', verifyToken, getIncidentsByUser);
router.get('/stats', verifyToken, getProviderIncidentStats);

// Registro y flujo colaborativo de solución
router.post('/', verifyToken, createIncident);
router.patch('/:id/respond', verifyToken, respondToIncident);
router.patch('/:id/resolve', verifyToken, resolveIncident);

export default router;
