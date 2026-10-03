export const getWelcomeEmailTemplate = ({ name, email, tempPassword, loginUrl }) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #f1e2e7; }
        .header { background: linear-gradient(135deg, #D81B60 0%, #ad1457 100%); padding: 35px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 1px; }
        .header p { margin: 5px 0 0; font-size: 13px; opacity: 0.9; text-transform: uppercase; letter-spacing: 2px; }
        .body { padding: 35px 30px; color: #444444; line-height: 1.6; }
        .credentials-box { background-color: #fdf2f6; border-left: 4px solid #D81B60; padding: 18px; border-radius: 8px; margin: 25px 0; }
        .pwd-code { background: #ffffff; padding: 6px 12px; border-radius: 6px; color: #D81B60; font-family: monospace; font-size: 18px; font-weight: bold; border: 1px solid #f8bbd0; display: inline-block; margin-top: 5px; }
        .btn-cta { display: inline-block; background: linear-gradient(45deg, #D81B60, #ec407a); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 15px rgba(216, 27, 96, 0.3); }
        .footer { background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1>ANDREA FIGUEROA</h1>
            <p>Wedding & Event Planner</p>
        </div>
        <div class="body">
            <h2>¡Bienvenida, ${name}! 💕</h2>
            <p>Se ha creado tu cuenta en nuestra plataforma exclusiva para acompañarte paso a paso en la planificación de tu boda.</p>
            
            <div class="credentials-box">
                <p style="margin: 0 0 8px 0;"><strong>Usuario:</strong> ${email}</p>
                <p style="margin: 0;"><strong>Contraseña Temporal:</strong></p>
                <span class="pwd-code">${tempPassword}</span>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" class="btn-cta">Ingresar a Mi Panel</a>
            </div>

            <p style="font-size: 13px; color: #777;"><em>Nota: Por tu seguridad, te sugerimos cambiar esta contraseña temporal una vez que ingreses por primera vez.</em></p>
        </div>
        <div class="footer">
            © 2026 Andrea Figueroa Wedding Planner. Todos los derechos reservados.
        </div>
    </div>
</body>
</html>
`;

export const getResetPasswordEmailTemplate = ({ name, resetUrl }) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 20px; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #f1e2e7; }
        .header { background: linear-gradient(135deg, #D81B60 0%, #ad1457 100%); padding: 35px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 1px; }
        .body { padding: 35px 30px; color: #444444; line-height: 1.6; }
        .btn-cta { display: inline-block; background: linear-gradient(45deg, #D81B60, #ec407a); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 15px rgba(216, 27, 96, 0.3); }
        .footer { background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1>ANDREA FIGUEROA</h1>
        </div>
        <div class="body">
            <h2>Restablecer Contraseña 🔒</h2>
            <p>Hola <strong>${name}</strong>,</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón a continuación para asignar una nueva clave. Este enlace estará activo por <strong>15 minutos</strong>:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" class="btn-cta">Restablecer Contraseña</a>
            </div>

            <p style="font-size: 13px; color: #777;">Si no realizaste esta solicitud, puedes ignorar este correo de forma segura.</p>
        </div>
        <div class="footer">
            © 2026 Andrea Figueroa Wedding Planner.
        </div>
    </div>
</body>
</html>
`;