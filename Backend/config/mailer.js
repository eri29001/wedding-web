const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // O configura tu host SMTP
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS  // Contraseña de aplicación de Gmail
    }
});

module.exports = transporter;