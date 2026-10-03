import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

// Endpoint para ejecutar la supresión de datos (Derecho al Olvido)
router.post('/anonymize-account', async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ 
            success: false, 
            message: "El ID del usuario es requerido para ejecutar la supresión." 
        });
    }

    try {
        // Llamada al procedimiento almacenado de PL/pgSQL en PostgreSQL
        await query("SELECT sp_anonimizar_usuario($1)", [userId]);

        res.json({ 
            success: true, 
            message: "Los datos personales han sido anonimizados exitosamente en cumplimiento con la LOPDP." 
        });

    } catch (err) {
        console.error("Error al anonimizar usuario:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error de base de datos al procesar la solicitud de derecho al olvido." 
        });
    }
});

export default router;