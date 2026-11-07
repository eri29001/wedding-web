import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Tu correo emisor (ej. earrobalopez@gmail.com o correo corporativo)
        pass: process.env.EMAIL_PASS  // Contraseña de aplicación generada en Google
    }
});

export const sendEmailNotification = async ({ to, subject, html, attachments = [] }) => {
    try {
        const mailOptions = {
            from: `"WeddIA - Andrea Figueroa Wedding Planner" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✉️ Correo enviado con éxito:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error enviando correo:', error);
        return { success: false, error: error.message };
    }
};