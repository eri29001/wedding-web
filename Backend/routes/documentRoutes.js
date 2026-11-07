import { Router } from 'express';
import { generateBudgetPDF, sendBudgetEmail } from '../controllers/documentController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// Endpoint para descargar PDF directo en el navegador
router.get('/budget-pdf', verifyToken, generateBudgetPDF);

// Endpoint para enviar el correo con el resumen
router.post('/send-budget-email', verifyToken, sendBudgetEmail);

export default router;