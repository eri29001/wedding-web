import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            res.json({ success: true, userId: user.id, role: user.role, name: user.name });
        } else {
            res.status(401).json({ success: false, message: 'Contraseña incorrecta.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

export const register = async (req, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
    }
    try {
        const exist = await query("SELECT id FROM users WHERE email = $1", [email]);
        if (exist.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Correo ya registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newId = `user_${Date.now()}`;
        const userRole = role || 'novia';

        await query(
            "INSERT INTO users (id, email, password, name, role) VALUES ($1, $2, $3, $4, $5)",
            [newId, email, hashedPassword, name, userRole]
        );

        if (userRole === 'novia') {
            await query("INSERT INTO wedding_profiles (user_id) VALUES ($1)", [newId]);
        }

        res.status(201).json({ success: true, userId: newId, message: 'Usuario registrado correctamente.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const result = await query("SELECT name FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'El correo no se encuentra registrado.' });
        }
        res.json({ success: true, message: `Instrucciones de recuperación enviadas a ${email}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};