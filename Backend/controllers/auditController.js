import { pool } from '../config/db.js';

// Consultar el historial de cambios financieros y de fechas
export const getAuditHistory = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const queryText = `
            SELECT 
                id,
                table_name,
                action_type,
                record_id,
                changed_data,
                created_at
            FROM audit_logs
            WHERE changed_data->>'user_id' = $1 OR record_id = $1
            ORDER BY created_at DESC;
        `;

        const result = await pool.query(queryText, [userId]);

        res.status(200).json({
            success: true,
            history: result.rows
        });
    } catch (error) {
        console.error('Error al obtener historial de auditoría:', error);
        res.status(500).json({ success: false, message: 'Error interno al consultar la auditoría.' });
    }
};