import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

let chatModel = null;

if (process.env.GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("✅ Gemini AI configurado correctamente.");
    } catch (error) {
        console.error("❌ Error inicializando Gemini:", error);
    }
} else {
    console.warn("⚠️ Advertencia: GEMINI_API_KEY no encontrada en .env");
}

export { chatModel };