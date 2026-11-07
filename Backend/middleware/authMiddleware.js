import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_wedding_web_2026';

// ==============================================================
// MIDDLEWARE 1: VERIFICAR TOKEN DE AUTENTICACIÓN
// ==============================================================
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <TOKEN>

    if (!token) {
        return res.status(401).json({ success: false, message: 'Acceso denegado: Token de seguridad no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Contiene { id (o userId), role, name }
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Token inválido o expirado. Inicia sesión de nuevo.' });
    }
};

// Alias opcional para mantener compatibilidad si importas 'verificarToken' en otros lados
export const verificarToken = verifyToken;

// ==============================================================
// MIDDLEWARE 2: RESTRICCIÓN POR ROL (PLANNER / ADMIN)
// ==============================================================
export const requirePlanner = (req, res, next) => {
    if (req.user && (req.user.role === 'planner' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Acceso restringido: Se requieren permisos de Wedding Planner.' });
    }
};

// ==============================================================
// MIDDLEWARE 3: MODO SOLO LECTURA TRAS CIERRE DE BODA (JC / REGLA 2.4)
// ==============================================================
export const verifyReadOnlyMode = async (req, res, next) => {
    // Si la petición es de consulta (GET), se permite siempre
    if (req.method === 'GET') {
        return next();
    }

    // Los administradores o planners pueden editar incluso tras el cierre
    if (req.user && (req.user.role === 'planner' || req.user.role === 'admin')) {
        return next();
    }

    const userId = req.user.id || req.user.userId;

    try {
        const query = `
            SELECT status, is_read_only 
            FROM wedding_profiles 
            WHERE user_id = $1;
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length > 0) {
            const { status, is_read_only } = result.rows[0];

            if (is_read_only || status === 'Completada' || status === 'Cancelada') {
                return res.status(403).json({
                    success: false,
                    message: `Evento en estado '${status}'. La información se encuentra en modo de SOLO LECTURA y no puede ser modificada.`
                });
            }
        }

        next();
    } catch (error) {
        console.error('Error al verificar modo solo lectura:', error);
        res.status(500).json({ success: false, message: 'Error interno al validar permisos del evento.' });
    }
};

// Alias opcional para mantener compatibilidad
export const verificarModoSoloLectura = verifyReadOnlyMode;