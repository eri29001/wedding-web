//Este apartado funciona para visualizar los modelos que ofrece Geminis para integrar un chatbot en la web,
//Primero abrimos el terminal en el backend (puede ser desde el CMD o Powershell también), ejecutamos 'node test_models.js' para ver la lista
//Es importante ver cuál se adaptará si se decide adquirir un plan de licensia para acceder a las mejores funciones del chatbot
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

console.log("🔍 Consultando a Google qué modelos tienes disponibles...");

async function checkModels() {
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            console.error("❌ Error de Google:", data.error.message);
        } else if (data.models) {
            console.log("✅ ¡Conexión Exitosa! Estos son los modelos exactos que puedes usar:");
            console.log("---------------------------------------------------------------");
            // Srive para filtrar solo los que sirven para chatear
            const chatModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
            chatModels.forEach(m => console.log(`👉 "${m.name.replace('models/', '')}"`));
            console.log("---------------------------------------------------------------");
            console.log("Copia uno de los nombres de arriba (ej: gemini-1.5-flash) para ponerlo en tu server.js, copia y pega en la línea 20 de 'server.js'");
        } else {
            console.log("⚠️ Respuesta extraña:", data);
        }
    } catch (error) {
        console.error("❌ Error de red:", error);
    }
}

checkModels();