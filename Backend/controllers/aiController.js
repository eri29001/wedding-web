import { model } from '../config/gemini.js';
import { query } from '../config/db.js';

// =========================================================================
// 1. AUTOMATIZACIÓN PARA LA WEDDING PLANNER (Ahorro de 5 horas de gestión)
// Genera un reporte ejecutivo diario analizando los datos reales en PostgreSQL
// =========================================================================
export const generatePlannerExecutiveReport = async (req, res) => {
    try {
        // A. Consultar la vista 'v_resumen_novias' y las tablas de presupuestos y tareas
        const noviasRes = await query("SELECT * FROM v_resumen_novias");
        const noviasData = noviasRes.rows;

        const tareasPendientes = await query(`
            SELECT c.task_text, c.priority, u.name as novia 
            FROM checklist c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.is_completed = FALSE AND c.priority IN ('Alta', 'Urgente')
        `);

        // B. Estructurar el contexto recuperado de la base de datos para la IA
        const contextoBD = {
            total_novias_activas: noviasData.length,
            resumen_novias: noviasData,
            alertas_urgentes: tareasPendientes.rows
        };

        // C. Prompt para Gemini AI
        const prompt = `
            Actúa como la asistente ejecutiva sénior de la Wedding Planner Andrea Figueroa.
            Analiza los siguientes datos extraídos en tiempo real de la base de datos de la plataforma:
            
            ${JSON.stringify(contextoBD, null, 2)}

            Por favor, genera un "Reporte Diario de Avance y Plan de Acción" estructurado con:
            1. 📊 **Resumen General de Bodas Activas**: Estado global de presupuestos y avance del checklist.
            2. ⚠️ **Alertas Prioritarias**: Novias con presupuestos excedidos o tareas urgentes pendientes.
            3. 📋 **Plan de Acción para Hoy**: 3 a 5 tareas clave que Andrea debe ejecutar hoy para ahorrar tiempo de gestión.
            4. 💬 **Borrador de Mensaje de Seguimiento**: Un mensaje cordial para enviar por WhatsApp a la novia con más tareas pendientes.

            Redáctalo en un tono sumamente profesional, ejecutivo y sintetizado.
        `;

        const result = await model.generateContent(prompt);
        const report = result.response.text();

        res.json({ success: true, report: report, raw_data: contextoBD });
    } catch (error) {
        console.error("Error al generar reporte de Planner:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =========================================================================
// 2. AUTOMATIZACIÓN PARA LA NOVIA (Asistente Personal de Boda)
// Lee la base de datos y genera el plan del día y recomendaciones personalizadas
// =========================================================================
export const generateBridePersonalAssistant = async (req, res) => {
    try {
        const { userId } = req.params;

        // A. Consultar la BD para obtener el perfil completo y el estado del presupuesto/checklist
        const perfilRes = await query("SELECT * FROM v_resumen_novias WHERE user_id = $1", [userId]);
        const tareasRes = await query("SELECT task_text, priority, is_completed FROM checklist WHERE user_id = $1", [userId]);
        const budgetRes = await query("SELECT item_name, estimated_cost, paid_amount, status FROM budget WHERE user_id = $1", [userId]);

        if (perfilRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "No se encontraron datos de la novia." });
        }

        const novia = perfilRes.rows[0];
        const tareas = tareasRes.rows;
        const presupuesto = budgetRes.rows;

        // B. Prompt para Gemini AI alimentado por PostgreSQL
        const prompt = `
            Eres 'WeddIA', la consultora de bodas inteligente de la novia ${novia.novia_nombre}.
            Aquí tienes los datos actualizados de su boda desde la base de datos:
            - Fecha de la boda: ${novia.wedding_date || 'Por definir'}
            - Presupuesto estimado: $${novia.presupuesto_estimado} | Total Pagado: $${novia.total_pagado}
            - Avance de tareas: ${novia.tareas_completadas} de ${novia.total_tareas} completadas.
            - Lista de gastos actuales: ${JSON.stringify(presupuesto)}
            - Tareas pendientes: ${JSON.stringify(tareas.filter(t => !t.is_completed))}

            Proporciona una respuesta cálida, motivadora y personalizada que incluya:
            1. 💡 Un análisis del estado financiero actual de su boda (si está dentro del límite o debe ajustar).
            2. 🎯 Las próximas 2 tareas prioritarias en las que debería enfocarse esta semana.
            3. ✨ Un consejo experto relativo a la etapa actual de su boda.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        res.json({ success: true, advice: responseText, novia_summary: novia });
    } catch (error) {
        console.error("Error en asistente de novia:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =========================================================================
// 3. GENERADOR AUTOMÁTICO DE VOTOS MATRIMONIALES (Basado en Perfil BD)
// =========================================================================
export const generateVows = async (req, res) => {
    try {
        const { userId, tono, anecdotas } = req.body;

        const profileRes = await query("SELECT partner_name, estilos_preferidos FROM wedding_profiles WHERE user_id = $1", [userId]);
        const perfil = profileRes.rows[0] || {};

        const prompt = `
            Escribe unos votos matrimoniales emotivos para dedicar a ${perfil.partner_name || 'mi pareja'}.
            - Tono deseado: ${tono || 'Emotivo y romántico'}.
            - Estilo de la boda: ${perfil.estilos_preferidos || 'Elegante'}.
            - Anécdotas o detalles a incluir: ${anecdotas || 'Nuestra trayectoria juntos y el compromiso futuro'}.

            Escribe los votos en primera persona, listos para ser leídos en la ceremonia.
        `;

        const result = await model.generateContent(prompt);
        res.json({ success: true, vows: result.response.text() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};