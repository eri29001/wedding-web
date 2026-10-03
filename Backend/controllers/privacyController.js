import { query } from '../config/db.js';

// LOPDP: Derecho de Acceso y Portabilidad de Datos
export const exportUserData = async (req, res) => {
    try {
        const { userId } = req.params;

        // Obtener la totalidad de los registros vinculados al titular
        const user = await query("SELECT id, name, email, role, created_at FROM users WHERE id = $1", [userId]);
        const profile = await query("SELECT * FROM wedding_profiles WHERE user_id = $1", [userId]);
        const budget = await query("SELECT * FROM budget WHERE user_id = $1", [userId]);
        const checklist = await query("SELECT * FROM checklist WHERE user_id = $1", [userId]);
        const guests = await query("SELECT * FROM guests WHERE user_id = $1", [userId]);
        const consents = await query("SELECT * FROM user_consents WHERE user_id = $1", [userId]);

        if (user.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado." });
        }

        // Retornar expediente digital consolidado en formato estándar JSON
        res.json({
            success: true,
            exported_at: new Date().toISOString(),
            law_compliance: "LOPDP Ecuador - Derecho de Portabilidad",
            data: {
                personal_info: user.rows[0],
                wedding_profile: profile.rows[0] || {},
                budget_items: budget.rows,
                tasks: checklist.rows,
                guest_list: guests.rows,
                consent_history: consents.rows
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// LOPDP: Derecho de Supresión / Derecho al Olvido
export const requestDataDeletion = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: "ID de usuario requerido." });
        }

        // Ejecutamos el procedimiento almacenado en PostgreSQL
        await query("SELECT sp_anonimizar_usuario($1)", [userId]);

        res.json({
            success: true,
            message: "Sus datos personales han sido anonimizados en conformidad con la LOPDP."
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};