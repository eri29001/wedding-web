import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_wedding_web_2026';

// Middleware 1: Verificar Token
export const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <TOKEN>

    if (!token) {
        return res.status(401).json({ success: false, message: 'Acceso denegado: Token de seguridad no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Guardamos { userId, role, name } en la petición
        next();
    } catch (error) {
        return res.status(403).json({ success: false, message: 'Token inválido o expirado. Inicia sesión de nuevo.' });
    }
};

// Middleware 2: Restricción por Rol (Planner/Admin)
export const requirePlanner = (req, res, next) => {
    if (req.user && (req.user.role === 'planner' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Acceso restringido: Se requieren permisos de Wedding Planner.' });
    }
};