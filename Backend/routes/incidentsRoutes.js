import { Router } from 'express';
import {
    createIncident,
    respondToIncident,
    resolveIncident,
    getIncidentsByUser,
    getProviderIncidentStats
} from '../controllers/incidentsController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = Router();

// Consultar incidencias y métricas
router.get('/', verificarToken, getIncidentsByUser);
router.get('/stats', verificarToken, getProviderIncidentStats);

// Registro y flujo colaborativo de solución
router.post('/', verificarToken, createIncident);
router.patch('/:id/respond', verificarToken, respondToIncident);
router.patch('/:id/resolve', verificarToken, resolveIncident);

export default router;