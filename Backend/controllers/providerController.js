import { query } from '../config/db.js';

export const getProviders = async (req, res) => {
    try {
        const result = await query("SELECT * FROM proveedores");
        const data = result.rows.map(p => ({ ...p, estilo: p.estilo ? p.estilo.split(',') : [] }));
        res.json({ data: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const getRecommendations = async (req, res) => {
    try {
        const { userId } = req.params;
        const perfilRes = await query("SELECT * FROM wedding_profiles WHERE user_id = $1", [userId]);
        const perfil = perfilRes.rows[0];

        const provRes = await query("SELECT * FROM proveedores");
        const proveedores = provRes.rows;

        if (!perfil) return res.json({ success: true, data: proveedores }); 

        const recomendados = proveedores.map(p => {
            let score = 0;
            const costo = parseFloat(p.costo) || 0;
            const budgetLimit = parseFloat(perfil.budget_limit) || 0;
            if (costo <= budgetLimit * 0.40) score += 50;
            if (perfil.estilos_preferidos && p.estilo && p.estilo.toLowerCase().includes(perfil.estilos_preferidos.toLowerCase())) score += 50;
            return { ...p, score };
        }).sort((a, b) => b.score - a.score);

        res.json({ success: true, data: recomendados });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const selectProvider = async (req, res) => {
    try {
        const { userId, proveedorId } = req.body;
        await query("INSERT INTO proveedores_seleccionados (user_id, proveedor_id) VALUES ($1, $2)", [userId, proveedorId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};