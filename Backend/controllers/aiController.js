import { chatModel } from '../config/gemini.js';

export const chatWithIA = async (req, res) => {
    const { messages, message, userName, fileData, role } = req.body;
    try {
        let ultimoMensaje = messages?.length ? messages[messages.length - 1].content : message || "...";
        let systemInstruction = role === 'planner' || role === 'admin'
            ? "Eres el Asistente Ejecutivo de la Wedding Planner Andrea Figueroa."
            : `Eres 'AF Virtual', asistente de la novia ${userName || 'Novia'}.`;

        const promptParts = [{ text: systemInstruction }, { text: `Usuario: ${ultimoMensaje}` }];
        if (fileData) promptParts.push(fileData);

        if (!chatModel) return res.json({ success: true, response: "Modelo de IA iniciando..." });

        const result = await chatModel.generateContent(promptParts);
        res.json({ success: true, response: result.response.text() });
    } catch (error) {
        console.error("AI Error:", error);
        res.json({ success: true, response: "Error temporal de conexión con el modelo de IA." });
    }
};

export const generateVows = async (req, res) => {
    const { partnerName, tone, keyMoments, qualities } = req.body;
    if (!partnerName || !tone) {
        return res.status(400).json({ success: false, message: 'Nombre de la pareja y tono requeridos.' });
    }
    try {
        const prompt = `Actúa como Wedding Planner redactando votos para una novia. Pareja: ${partnerName}, Tono: ${tone}, Anécdotas: ${keyMoments || 'Nuestra historia'}, Cualidades: ${qualities || 'Su apoyo'}. Redacta sólo los votos en primera persona.`;
        if (!chatModel) return res.status(500).json({ success: false, message: "Modelo de IA no disponible." });

        const result = await chatModel.generateContent(prompt);
        res.json({ success: true, vows: result.response.text() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

export const budgetSimulator = (req, res) => {
    const { totalBudget, guestsCount } = req.body;
    const budget = parseFloat(totalBudget);
    const guests = parseInt(guestsCount) || 0;

    if (isNaN(budget) || budget <= 0) {
        return res.status(400).json({ success: false, message: 'Presupuesto inválido.' });
    }

    res.json({
        success: true,
        totalBudget: budget,
        costPerGuest: guests > 0 ? (budget / guests).toFixed(2) : 0,
        breakdown: {
            banquetAndCatering: (budget * 0.40).toFixed(2),
            venueAndDecoration: (budget * 0.20).toFixed(2),
            photographyAndVideo: (budget * 0.15).toFixed(2),
            musicAndLighting: (budget * 0.10).toFixed(2),
            attireAndBeauty: (budget * 0.10).toFixed(2),
            contingencyReserve: (budget * 0.05).toFixed(2)
        }
    });
};