import { Router } from 'express';
import { 
    generatePlannerExecutiveReport, 
    generateBridePersonalAssistant, 
    generateVows 
} from '../controllers/aiController.js';
import { verifyToken, requirePlanner } from '../middleware/authMiddleware.js';

const router = Router();

// Endpoint para la Wedding Planner: Genera reporte diario desde PostgreSQL (Protegido con JWT + Rol Planner)
router.get('/ai/planner-report', verifyToken, requirePlanner, generatePlannerExecutiveReport);

// Endpoint para la Novia: Asistente personalizado con datos de su BD
router.get('/ai/bride-assistant/:userId', verifyToken, generateBridePersonalAssistant);

// Endpoint para Votos Matrimoniales
router.post('/ai/generate-vows', verifyToken, generateVows);

export default router;