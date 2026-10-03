import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from '../config/db.js';
import transporter from '../config/mailer.js';
import { getResetPasswordEmailTemplate } from '../config/emailTemplates.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_wedding_web_2026';

// ======================================================
// 1. INICIO DE SESIÓN (LOGIN - SESIÓN DE 7 DÍAS)
// ======================================================
export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
        }

        const user = result.rows[0];

        // Cumplimiento LOPDP: Prevenir acceso a cuentas dadas de baja
        if (user.is_anonymized) {
            return res.status(403).json({ success: false, message: 'Esta cuenta ha sido dada de baja por solicitud del usuario.' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (match) {
            // Ampliado a 7 días para evitar cierres constantes de sesión
            const token = jwt.sign(
                { userId: user.id, role: user.role, name: user.name },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({ 
                success: true, 
                token: token,
                userId: user.id, 
                role: user.role, 
                name: user.name,
                mustChangePassword: user.must_change_password || false
            });
        } else {
            res.status(401).json({ success: false, message: 'Contraseña incorrecta.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ======================================================
// 2. REGISTRO DE USUARIOS CON TRANSACCIÓN ACID
// ======================================================
export const register = async (req, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const exist = await client.query("SELECT id FROM users WHERE email = $1", [email]);
        if (exist.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Correo ya registrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newId = `user_${Date.now()}`;
        const userRole = role || 'novia';

        await client.query(
            "INSERT INTO users (id, email, password, name, role) VALUES ($1, $2, $3, $4, $5)",
            [newId, email, hashedPassword, name, userRole]
        );

        if (userRole === 'novia') {
            await client.query("INSERT INTO wedding_profiles (user_id) VALUES ($1)", [newId]);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, userId: newId, message: 'Usuario registrado correctamente.' });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
};

// ======================================================
// 3. SOLICITAR RECUPERACIÓN DE CONTRASEÑA
// ======================================================
export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ success: false, message: 'El correo electrónico es obligatorio.' });
    }

    try {
        const result = await query("SELECT * FROM users WHERE email = $1", [email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'El correo electrónico no se encuentra registrado en el sistema.' 
            });
        }

        const user = result.rows[0];

        // Generar token único y expiración en 15 minutos
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 15 * 60 * 1000); 

        // Guardar token en PostgreSQL
        await query(
            "UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3",
            [token, expires, user.id]
        );

        const frontendUrl = process.env.FRONTEND_URL || 'https://wedding-web-lygz.onrender.com';
        const resetUrl = `${frontendUrl}/reset-password.html?token=${token}`;

        // Enviar plantilla de correo maquetada
        await transporter.sendMail({
            from: `"Andrea Figueroa WP" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Restablecer contraseña - Andrea Figueroa Wedding Planner',
            html: getResetPasswordEmailTemplate({
                name: user.name || 'Cliente',
                resetUrl
            })
        });

        res.json({ 
            success: true, 
            message: 'Se han enviado las instrucciones a tu correo electrónico.' 
        });

    } catch (err) {
        console.error('Error en forgotPassword:', err);
        res.status(500).json({ success: false, message: 'Error de servidor al procesar la solicitud.' });
    }
};

// ======================================================
// 4. RESTABLECER CONTRASEÑA CON TOKEN
// ======================================================
export const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Datos incompletos.' });
    }

    try {
        // Verificar token vigente
        const result = await query(
            "SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'El enlace ha expirado o no es válido. Por favor, solicita una nueva recuperación.' 
            });
        }

        const user = result.rows[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Actualizar contraseña, limpiar tokens y desactivar el cambio obligatorio
        await query(
            "UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL, must_change_password = FALSE WHERE id = $2",
            [hashedPassword, user.id]
        );

        res.json({ 
            success: true, 
            message: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' 
        });

    } catch (err) {
        console.error('Error en resetPassword:', err);
        res.status(500).json({ success: false, message: 'Error de servidor al actualizar la contraseña.' });
    }
};