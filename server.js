import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
// import sqlite3 from 'sqlite3'; // <-- YA NO USAMOS ESTE
import { createClient } from '@libsql/client'; // <-- USAMOS ESTE PARA TURSO
import { filtrarConIA } from './aiLogic.js'; 

// Carga el .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Render asigna un puerto automáticamente

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// ==========================================
// 1. CONFIGURACIÓN BASE DE DATOS (TURSO)
// ==========================================

const db = createClient({
    url: process.env.DB_URL || "file:local-fallback.db", // Lee del .env
    authToken: process.env.DB_TOKEN // Lee del .env
});

// Función para inicializar tablas (Turso usa async/await)
async function inicializarBaseDeDatos() {
    try {
        // Tabla Proveedores
        await db.execute(`CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            tipo TEXT NOT NULL,
            presupuesto TEXT NOT NULL,
            estilo TEXT,
            contacto TEXT,
            descripcion TEXT,
            costo INTEGER
        )`);

        // Tabla Documentos
        await db.execute(`CREATE TABLE IF NOT EXISTS documentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_archivo TEXT,
            tipo TEXT, 
            url TEXT,
            compartido_planner BOOLEAN DEFAULT 0,
            dueño_id TEXT
        )`);

        // Tabla Eventos (Calendario)
        await db.execute(`CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT,
            start TEXT,
            color TEXT,
            brideId TEXT,
            target TEXT,
            deadline TEXT,
            description TEXT,
            link TEXT
        )`);

        console.log("✅ Tablas sincronizadas con Turso correctamente.");
    } catch (error) {
        console.error("❌ Error inicializando tablas en Turso:", error);
    }
}

// Ejecutamos la inicialización al arrancar
inicializarBaseDeDatos();


// ==========================================
// 2. CONFIGURACIÓN GEMINI (IA)
// ==========================================

let chatModel;
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: No se encontró API KEY en el archivo .env");
} else {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        chatModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); 
        console.log("✅ Gemini (AF Virtual) conectado y listo.");
    } catch (error) {
        console.error("❌ Error conectando con Gemini:", error);
    }
}

// ==========================================
// 3. DATOS EN MEMORIA (Login)
// ==========================================
const users = [
    { id: 'planner1', email: 'planner@andreafigueroa.com', password: 'plannercustommer_123', role: 'planner', full_name: 'Andrea Figueroa' },
    { id: 'novia1', email: 'earrobalopez@gmail.com', password: 'Gabi9090', role: 'novia', full_name: 'Erika Arroba' },
    { id: 'novia2', email: 'maria.gonzalez@boda.com', password: 'mariaBoda2026', role: 'novia', full_name: 'Maria Gonzalez' },
    { id: 'novia3', email: 'sofia.martinez@email.com', password: 'sofiaLove23', role: 'novia', full_name: 'Sofia Martinez' },
    { id: 'novia4', email: 'isabella.rojas@future.com', password: 'isaYjuan2025', role: 'novia', full_name:'Isabella Rojas'},
    { id: 'novia5', email: 'carla.ruiz@wedding.com', password: 'ruizBoda99', role: 'novia', full_name:'Carla Ruiz'},
    { id: 'novia6', email: 'valentina.lopez@dream.com', password: 'valeDiosa', role: 'novia', full_name:'Valentina Lopez'},
    { id: 'novia7', email: 'lucia.fer@mail.com', password: 'lucil120', role: 'novia', full_name:'Lucia Fernandez'}
];

let plannerInbox = [];

// ==========================================
// 4. RUTAS API: GESTIÓN Y EVENTOS (ADAPTADO A TURSO)
// ==========================================

app.get('/api/admin/proveedores', async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM proveedores");
        // En Turso, los datos vienen en result.rows
        const data = result.rows.map(p => ({ ...p, estilo: p.estilo ? p.estilo.split(',') : [] }));
        res.json({ data: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CALENDARIO (GET) ---
app.get('/api/events', async (req, res) => {
    const { brideId } = req.query;
    try {
        const result = await db.execute({
            sql: "SELECT * FROM events WHERE brideId = ?",
            args: [brideId]
        });
        
        const events = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            start: row.start,
            color: row.color,
            brideId: row.brideId,
            extendedProps: {
                target: row.target,
                deadline: row.deadline,
                desc: row.description,
                link: row.link
            }
        }));
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CALENDARIO (POST) ---
app.post('/api/events', async (req, res) => {
    const ev = req.body;
    const id = ev.id || Date.now().toString();
    const target = ev.extendedProps ? ev.extendedProps.target : ev.target;
    const desc = ev.extendedProps ? ev.extendedProps.desc : ev.desc;
    const deadline = ev.extendedProps ? ev.extendedProps.deadline : ev.deadline;
    const link = ev.extendedProps ? ev.extendedProps.link : ev.link;

    const sql = `INSERT OR REPLACE INTO events (id, title, start, color, brideId, target, deadline, description, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    try {
        await db.execute({
            sql: sql,
            args: [id, ev.title, ev.start, ev.color, ev.brideId, target, deadline, desc, link]
        });
        
        console.log(`📅 Evento guardado: ${ev.title}`);
        res.json({ success: true, id: id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. RUTAS API: IA Y CHATBOT 
// ==========================================

app.post('/api/ia/chat', async (req, res) => {
    const { messages, message, isNovia, userName, fileData, saveToInbox, summaryData, role } = req.body; 

    // Buzón de entrada
    if (saveToInbox && summaryData) {
        plannerInbox.push({
            id: Date.now(),
            type: fileData ? 'document' : 'insight',
            category: summaryData.category || 'General',
            text: summaryData.text,
            user: userName || 'Usuario',
            date: new Date().toISOString().split('T')[0],
            fileSimulated: !!fileData
        });
        return res.json({ success: true, response: "¡Listo! Información guardada en el Dashboard." });
    }

    try {
        let ultimoMensaje = "";
        if (messages && messages.length > 0) ultimoMensaje = messages[messages.length - 1].content;
        else if (message) ultimoMensaje = message;
        else return res.json({ success: false, response: "¿Hola? No he recibido ningún mensaje." });

        let systemInstruction = "";

        // Definición de Roles
        if (role === 'planner' || role === 'admin') {
            const datosNegocio = await obtenerDatosPlanner();
            systemInstruction = `Eres el Asistente Ejecutivo de la Wedding Planner. Tienes acceso a: ${JSON.stringify(datosNegocio)}. Responde de forma profesional y ejecutiva.`;
        } else if (isNovia || role === 'novia') {
            systemInstruction = `Eres 'AF Virtual', asistente de la novia. Eres amable, entusiasta y ayudas a calmar nervios. Responde corto (tipo WhatsApp).`;
        } else {
            systemInstruction = `Eres un asistente de bodas experto. Ayuda con dudas generales. Recomienda contactar a Andrea.`;
        }

        const promptParts = [{ text: systemInstruction }, { text: `Usuario dice: ${ultimoMensaje}` }];
        if (fileData) promptParts.push(fileData, { text: "Analiza este archivo." });

        if (!chatModel) return res.json({ success: true, response: "La IA se está iniciando, intenta en unos segundos." });

        const result = await chatModel.generateContent(promptParts);
        const responseText = result.response.text();
        
        res.json({ success: true, response: responseText });

    } catch (error) {
        console.error("Gemini Error:", error);
        res.json({ success: true, response: "Tuve un pequeño problema técnico. ¿Me lo repites?" });
    }
});

// ==========================================
// 6. RUTAS VARIAS Y LISTEN
// ==========================================

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (user) res.json({ success: true, userId: user.id, role: user.role, name: user.full_name });
    else res.status(401).json({ success: false, message: 'Credenciales incorrectas.' });
});

app.get('/api/dashboard-data', (req, res) => {
    res.json({ inbox: plannerInbox });
});

// Función auxiliar para leer BD (Adaptada a Turso con Promise.all)
async function obtenerDatosPlanner() {
    try {
        const [provResult, docResult] = await Promise.all([
            db.execute("SELECT nombre, tipo, presupuesto, costo FROM proveedores"),
            db.execute("SELECT nombre_archivo, tipo, url FROM documentos WHERE compartido_planner = 1")
        ]);
        return { proveedores: provResult.rows, documentos: docResult.rows };
    } catch (err) {
        console.error("Error obteniendo datos planner:", err);
        return { proveedores: [], docs: [] };
    }
}

app.listen(PORT, () => {
    console.log(`\n✨ SERVIDOR PLANNER LISTO EN PUERTO: ${PORT}`);
});