import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/db.js';
import transporter from '../config/mailer.js';

const router = Router();

// ======================================================
// 1. OBTENER RESUMEN DE TODAS LAS NOVIAS (VISTA SQL)
// ======================================================
router.get('/brides-summary', async (req, res) => {
    try {
        const result = await query("SELECT * FROM v_resumen_novias ORDER BY wedding_date ASC NULLS LAST");
        res.json({ success: true, brides: result.rows });
    } catch (err) {
        console.error("Error al obtener resumen de novias:", err);
        res.status(500).json({ success: false, message: "Error al consultar las novias registradas." });
    }
});

// ======================================================
// 2. CREAR NUEVA NOVIA CON CLAVE TEMPORAL AUTOGENERADA
// ======================================================
router.post('/create-bride', async (req, res) => {
    const { email, name, wedding_date, budget_limit } = req.body;

    // Solo requerimos Nombre y Correo
    if (!email || !name) {
        return res.status(400).json({ 
            success: false, 
            message: "El nombre y el correo electrónico son obligatorios." 
        });
    }

    try {
        // 1. Verificar si el correo ya existe
        const exist = await query("SELECT id FROM users WHERE email = $1", [email]);
        if (exist.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: "El correo electrónico ya se encuentra registrado." 
            });
        }

        // 2. Generar clave aleatoria de 8 caracteres (ejemplo: '3f8a10b9')
        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const userId = `novia_${Date.now()}`;

        // 3. Insertar usuario en la tabla 'users'
        await query(
            "INSERT INTO users (id, email, password, name, role) VALUES ($1, $2, $3, $4, 'novia')",
            [userId, email, hashedPassword, name]
        );

        // 4. Crear perfil de boda inicial
        await query(
            "INSERT INTO wedding_profiles (user_id, wedding_date, budget_limit) VALUES ($1, $2, $3)",
            [userId, wedding_date || null, budget_limit || 0]
        );

        // 5. Enviar correo de bienvenida con la contraseña temporal
        const loginUrl = `${process.env.FRONTEND_URL || 'https://wedding-web-lygz.onrender.com'}/login.html`;

        const mailOptions = {
            from: `"Andrea Figueroa WP" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '¡Bienvenida a Andrea Figueroa Wedding Planner! - Tus accesos',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 25px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #D81B60; text-align: center;">¡Bienvenida, ${name}!</h2>
                    <p>Andrea Figueroa ha creado tu cuenta en nuestra plataforma para acompañarte en la organización de tu boda.</p>
                    <p>A continuación encontrarás tus credenciales temporales de acceso:</p>
                    
                    <div style="background-color: #fdf2f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D81B60;">
                        <p style="margin: 5px 0;"><strong>Correo:</strong> ${email}</p>
                        <p style="margin: 5px 0;"><strong>Contraseña Temporal:</strong> <code style="background: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 1.1rem; color: #D81B60; border: 1px solid #ffcdd2; font-weight: bold;">${tempPassword}</code></p>
                    </div>

                    <div style="text-align: center; margin: 25px 0;">
                        <a href="${loginUrl}" style="background-color: #D81B60; color: white; padding: 12px 28px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                            Iniciar Sesión en la Plataforma
                        </a>
                    </div>
                    
                    <p style="font-size: 0.85rem; color: #777;">Te recomendamos cambiar esta contraseña por una personal una vez que ingreses a tu panel.</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.error("No se pudo enviar el correo de bienvenida:", mailErr);
        }

        // 6. Responder con el éxito y la contraseña generada
        res.status(201).json({ 
            success: true, 
            message: "Cuenta creada con éxito y credenciales enviadas por correo a la novia.", 
            userId,
            tempPassword // Se incluye en la respuesta para que Andrea la vea en su pantalla si lo requiere
        });

    } catch (err) {
        console.error("Error al crear novia:", err);
        res.status(500).json({ success: false, message: "Error interno del servidor al crear la cuenta." });
    }
});

// ======================================================
// 3. CAMBIO MANUAL DE CONTRASEÑA POR PARTE DE ANDREA
// ======================================================
router.put('/reset-bride-password', async (req, res) => {
    const { brideId, newPassword } = req.body;

    if (!brideId || !newPassword) {
        return res.status(400).json({ success: false, message: "ID de la novia y nueva contraseña requeridos." });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const result = await query(
            "UPDATE users SET password = $1 WHERE id = $2 AND role = 'novia'",
            [hashedPassword, brideId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Novia no encontrada." });
        }

        res.json({ success: true, message: "Contraseña actualizada con éxito." });

    } catch (err) {
        console.error("Error al resetear clave de la novia:", err);
        res.status(500).json({ success: false, message: "Error al actualizar la contraseña en la base de datos." });
    }
});

export default router;