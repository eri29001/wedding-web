import { query } from '../config/db.js';
import { filtrarConIA } from '../aiLogic.js';

// 1. Obtener catálogo completo de proveedores
export const getProviders = async (req, res) => {
    try {
        const result = await query("SELECT * FROM proveedores ORDER BY id ASC");
        const data = result.rows.map(p => ({
            ...p,
            estilo: p.estilo 
                ? (Array.isArray(p.estilo) ? p.estilo : p.estilo.split(',').map(e => e.trim())) 
                : []
        }));
        res.json({ data: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 2. Obtener recomendaciones inteligentes cruzando perfil con aiLogic
export const getRecommendations = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Obtener perfil de la novia en PostgreSQL
        const perfilRes = await query("SELECT * FROM wedding_profiles WHERE user_id = $1", [userId]);
        const perfil = perfilRes.rows[0] || {};

        // Obtener la lista general de proveedores
        const provRes = await query("SELECT * FROM proveedores");
        const proveedores = provRes.rows;

        if (!proveedores || proveedores.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // Aplicar el algoritmo de scoring y coincidencia de estilo de aiLogic.js
        const recomendados = filtrarConIA(perfil, proveedores);

        res.json({ 
            success: true, 
            data: recomendados.length > 0 ? recomendados : proveedores 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// 3. Registrar selección de proveedor por parte de la novia
export const selectProvider = async (req, res) => {
    try {
        const { userId, proveedorId } = req.body;
        
        if (!userId || !proveedorId) {
            return res.status(400).json({ success: false, message: "Faltan datos obligatorios." });
        }

        await query(
            "INSERT INTO proveedores_seleccionados (user_id, proveedor_id) VALUES ($1, $2)",
            [userId, proveedorId]
        );
        
        res.json({ success: true, message: "Proveedor guardado exitosamente." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};