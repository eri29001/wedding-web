import bcrypt from 'bcryptjs';
import { pool, query } from '../config/db.js'; // Importamos 'pool' para transacciones atómicas

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_wedding_web_2026';

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
            // Generar Token JWT con vigencia de 24 horas
            const token = jwt.sign(
                { userId: user.id, role: user.role, name: user.name },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({ 
                success: true, 
                token: token,
                userId: user.id, 
                role: user.role, 
                name: user.name 
            });
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

    // Reservamos un cliente dedicado del pool para controlar la transacción
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Inicio de Transacción ACID

        const exist = await client.query("SELECT id FROM users WHERE email = $1", [email]);
        if (exist.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Correo ya registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newId = `user_${Date.now()}`;
        const userRole = role || 'novia';

        // Operación 1: Insertar en la tabla 'users'
        await client.query(
            "INSERT INTO users (id, email, password, name, role) VALUES ($1, $2, $3, $4, $5)",
            [newId, email, hashedPassword, name, userRole]
        );

        // Operación 2: Insertar en la tabla 'wedding_profiles' (Dependiente)
        if (userRole === 'novia') {
            await client.query("INSERT INTO wedding_profiles (user_id) VALUES ($1)", [newId]);
        }

        await client.query('COMMIT'); // Se confirman los cambios si ambas operaciones tuvieron éxito
        res.status(201).json({ success: true, userId: newId, message: 'Usuario registrado correctamente.' });

    } catch (err) {
        await client.query('ROLLBACK'); // Se revierten todas las inserciones en caso de fallo
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release(); // Se libera el cliente de vuelta al pool
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