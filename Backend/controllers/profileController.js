import { query } from '../config/db.js';

export const getProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const userRes = await query("SELECT name FROM users WHERE id = $1", [userId]);
        const profileRes = await query("SELECT * FROM wedding_profiles WHERE user_id = $1", [userId]);
        
        if (userRes.rows.length > 0) {
            const nombre = userRes.rows[0].name;
            const perfil = profileRes.rows[0] || {};
            res.json({ 
                success: true, 
                user: { 
                    name: nombre,
                    wedding_date: perfil.wedding_date,
                    budget: perfil.budget_limit
                } 
            });
        } else {
            res.status(404).json({ success: false, message: "Usuario no encontrado." });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const saveProfile = async (req, res) => {
    try {
        const { userId, nombre, pareja, fecha_boda, presupuesto, estilo, avatarBase64 } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: "Falta ID de usuario." });

        await query(`
            INSERT INTO wedding_profiles (user_id, wedding_date, budget_limit, estilos_preferidos, partner_name, avatar)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT(user_id) DO UPDATE SET 
                wedding_date = excluded.wedding_date,
                budget_limit = excluded.budget_limit,
                estilos_preferidos = excluded.estilos_preferidos,
                partner_name = excluded.partner_name,
                avatar = excluded.avatar
        `, [userId, fecha_boda, presupuesto, estilo, pareja, avatarBase64]);

        if (nombre) {
            await query("UPDATE users SET name = $1 WHERE id = $2", [nombre, userId]);
        }

        res.json({ success: true, message: "Perfil guardado correctamente.", user: { name: nombre } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const saveDocument = async (req, res) => {
    try {
        const { userId, fileName, fileType, fileUrl, eventId } = req.body;
        await query(
            "INSERT INTO documentos (dueño_id, nombre_archivo, tipo, url, event_id, compartido_planner) VALUES ($1, $2, $3, $4, $5, TRUE)",
            [userId, fileName, fileType, fileUrl, eventId || null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const getGuests = async (req, res) => {
    try {
        const rs = await query("SELECT * FROM guests WHERE user_id = $1", [req.params.userId]);
        res.json({ success: true, data: rs.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createGuest = async (req, res) => {
    try {
        const { userId, name } = req.body;
        await query("INSERT INTO guests (user_id, name) VALUES ($1, $2)", [userId, name]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};