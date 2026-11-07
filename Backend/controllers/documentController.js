import PDFDocument from 'pdfkit';
import { pool } from '../config/db.js';
import { sendEmailNotification } from '../config/mailer.js';

// Generar PDF de Cotización / Resumen Financiero de la Boda
export const generateBudgetPDF = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        // 1. Consultar datos de la novia y su presupuesto en la BD
        const profileRes = await pool.query(
            "SELECT u.name, u.email, wp.wedding_date, wp.partner_name FROM users u LEFT JOIN wedding_profiles wp ON u.id = wp.user_id WHERE u.id = $1",
            [userId]
        );

        const budgetRes = await pool.query(
            "SELECT item_name, category, estimated_cost, paid_amount, status FROM budget WHERE user_id = $1",
            [userId]
        );

        if (profileRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Perfil de boda no encontrado.' });
        }

        const novia = profileRes.rows[0];
        const presupuestos = budgetRes.rows;

        // 2. Crear documento PDF con PDFKit
        const doc = new PDFDocument({ margin: 50 });

        // Configurar Headers para descarga directa en el navegador
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Cotizacion_Boda_${novia.name.replace(/\s+/g, '_')}.pdf`);

        doc.pipe(res);

        // Encabezado del PDF
        doc.fillColor('#4B2E83').fontSize(20).text('ANDREA FIGUEROA WEDDING PLANNER', { align: 'center' });
        doc.fontSize(12).fillColor('#333333').text('Resumen Ejecutivo de Presupuesto y Servicios', { align: 'center' });
        doc.moveDown(1.5);

        // Detalles del Cliente y Evento
        doc.fontSize(10).text(`Novia: ${novia.name}`);
        doc.text(`Pareja: ${novia.partner_name || 'Por definir'}`);
        doc.text(`Fecha del Evento: ${novia.wedding_date || 'Por definir'}`);
        doc.text(`Correo: ${novia.email}`);
        doc.moveDown(1);
        doc.text('--------------------------------------------------------------------------------------------------', { align: 'center' });
        doc.moveDown(1);

        // Tabla de ítems presupuestados
        doc.fontSize(12).fillColor('#4B2E83').text('Desglose de Gastos y Contrataciones:');
        doc.moveDown(0.5);

        let totalEstimado = 0;
        let totalPagado = 0;

        presupuestos.forEach((item, index) => {
            const estimado = parseFloat(item.estimated_cost || 0);
            const pagado = parseFloat(item.paid_amount || 0);
            totalEstimado += estimado;
            totalPagado += pagado;

            doc.fontSize(10).fillColor('#000000').text(
                `${index + 1}. ${item.item_name} (${item.category || 'General'}) - Estimado: $${estimado.toFixed(2)} | Pagado: $${pagado.toFixed(2)} [${item.status}]`
            );
        });

        doc.moveDown(1.5);
        doc.fontSize(12).fillColor('#2E7D32').text(`Total Estimado: $${totalEstimado.toFixed(2)}`, { align: 'right' });
        doc.text(`Total Abonado: $${totalPagado.toFixed(2)}`, { align: 'right' });
        doc.text(`Saldo Pendiente: $${(totalEstimado - totalPagado).toFixed(2)}`, { align: 'right' });

        // Pie de página
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#777777').text('Documento generado automáticamente por la plataforma Web Planning.', { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ success: false, message: 'Error interno al generar el documento PDF.' });
    }
};

// Notificar por correo electrónico el resumen del presupuesto
export const sendBudgetEmail = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const profileRes = await pool.query("SELECT name, email FROM users WHERE id = $1", [userId]);
        const user = profileRes.rows[0];

        const htmlContent = `
            <h2>¡Hola ${user.name}!</h2>
            <p>Se ha actualizado el resumen de tu boda en la plataforma <strong>Web Planning</strong>.</p>
            <p>Puedes ingresar al sistema para consultar el desglose detallado de proveedores y pagos acordados.</p>
            <br/>
            <p>Atentamente,<br/><strong>Andrea Figueroa - Wedding Planner</strong></p>
        `;

        const result = await sendEmailNotification({
            to: user.email,
            subject: 'Actualización de Presupuesto - Web Planning',
            html: htmlContent
        });

        if (result.success) {
            res.json({ success: true, message: 'Notificación enviada al correo exitosamente.' });
        } else {
            res.status(500).json({ success: false, message: 'No se pudo enviar el correo.' });
        }
    } catch (error) {
        console.error('Error enviando notificación:', error);
        res.status(500).json({ success: false, message: 'Error al procesar el envío de correo.' });
    }
};