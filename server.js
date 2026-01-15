import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@libsql/client'; 

// Carga el .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==========================================
// 1. CONFIGURACIÓN BASE DE DATOS 

const db = createClient({
    url: process.env.DB_URL || "file:local-fallback.db",
    authToken: process.env.DB_TOKEN
});

async function inicializarBaseDeDatos() {
    try {
        // --- 1. Tabla Proveedores  ---
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

        // --- 2. Tabla Documentos  ---
        await db.execute(`CREATE TABLE IF NOT EXISTS documentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_archivo TEXT,
            tipo TEXT, 
            url TEXT,
            compartido_planner BOOLEAN DEFAULT 0,
            dueño_id TEXT,
            event_id TEXT -- Vinculación con calendario
        )`);

        // --- 3. Tabla Eventos (Calendario) ---
        await db.execute(`CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT,
            start TEXT,
            color TEXT,
            brideId TEXT, -- ID de la novia dueña del evento
            target TEXT,
            deadline TEXT,
            description TEXT,
            link TEXT
        )`);

        // --- 4. Tabla Invitados ---
        await db.execute(`CREATE TABLE IF NOT EXISTS guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            name TEXT,
            status TEXT DEFAULT 'Pendiente'
        )`);

        // --- 5. Perfil de Boda (Configuración Novia) ---
        await db.execute(`CREATE TABLE IF NOT EXISTS wedding_profiles (
            user_id TEXT PRIMARY KEY,
            wedding_date TEXT,
            budget_limit REAL,
            estilos_preferidos TEXT,
            invitados_estimados INTEGER
        )`);

        // --- 6. Presupuesto (Items de gasto) ---
        await db.execute(`CREATE TABLE IF NOT EXISTS budget (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            category TEXT,
            item_name TEXT,
            estimated_cost REAL,
            final_cost REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            status TEXT DEFAULT 'Pendiente'
        )`);

        // --- 7. Checklist (Tareas) ---
        await db.execute(`CREATE TABLE IF NOT EXISTS checklist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            task_text TEXT,
            is_completed BOOLEAN DEFAULT 0,
            priority TEXT DEFAULT 'Normal'
        )`);

        // --- 8. Proveedores Seleccionados (Carrito de la Novia) ---
        await db.execute(`CREATE TABLE IF NOT EXISTS proveedores_seleccionados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            proveedor_id INTEGER,
            estado TEXT DEFAULT 'Contratado',
            FOREIGN KEY(proveedor_id) REFERENCES proveedores(id)
        )`);

        console.log("✅ Tablas sincronizadas con Turso correctamente.");
    } catch (error) {
        console.error("❌ Error inicializando tablas en Turso:", error);
    }
}

inicializarBaseDeDatos();


// ==========================================
// 2. CONFIGURACIÓN GEMINI (IA)
// ==========================================

let chatModel;
if (!process.env.GEMINI_API_KEY) {
    console.error("⚠️ ADVERTENCIA: No se encontró GEMINI_API_KEY en .env");
} else {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        console.log("✅ Gemini (IA) conectado.");
    } catch (error) {
        console.error("❌ Error conectando Gemini:", error);
    }
}

// 3. DATOS EN MEMORIA 

const users = [
    // --- ADMIN / PLANNER ---
    { 
        id: 'planner_andrea', 
        email: 'planner@andreafigueroa.com', 
        password: 'plannercustommer_123', 
        role: 'planner', 
        full_name: 'Andrea Figueroa' 
    },

    // --- PERFILES DE NOVIAS ---
    { 
        id: 'novia_erika', 
        email: 'earrobalopez@gmail.com', 
        password: 'Gabi9090', 
        role: 'novia', 
        full_name: 'Erika Arroba' 
    },
    { 
        id: 'novia_maria', 
        email: 'maria.gonzalez@boda.com', 
        password: 'mariaBoda2026', 
        role: 'novia', 
        full_name: 'María González' 
    },
    { 
        id: 'novia_isabella', 
        email: 'isabella.rojas@future.com', 
        password: 'isaYjuan2025', 
        role: 'novia', 
        full_name: 'Isabella Rojas' 
    },
    { 
        id: 'novia_carla', 
        email: 'carla.ruiz@wedding.com', 
        password: 'ruizBoda99', 
        role: 'novia', 
        full_name: 'Carla Ruiz' 
    },
    { 
        id: 'novia_sofia', 
        email: 'sofia.martinez@email.com', 
        password: 'sofiaLove23', 
        role: 'novia', 
        full_name: 'Sofía Martínez' 
    },
    { 
        id: 'novia_valentina', 
        email: 'valentina.lopez@dream.com', 
        password: 'valeDiosa', 
        role: 'novia', 
        full_name: 'Valentina López' 
    },
    { 
        id: 'novia_lucia', 
        email: 'lucia.fer@mail.com', 
        password: 'lucil120', 
        role: 'novia', 
        full_name: 'Lucía Fer' 
    }
];

let plannerInbox = []; 

// ==========================================
// 4. RUTAS API: AUTENTICACIÓN Y ADMIN
// ==========================================

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    // Búsqueda simple en el array de memoria
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        res.json({ 
            success: true, 
            userId: user.id, 
            role: user.role, 
            name: user.full_name 
        });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales incorrectas.' });
    }
});

// Admin: Obtener catálogo completo de proveedores
app.get('/api/admin/proveedores', async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM proveedores");
        const data = result.rows.map(p => ({ ...p, estilo: p.estilo ? p.estilo.split(',') : [] }));
        res.json({ data: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. RUTAS API: CALENDARIO (NOVIA Y PLANNER)
// ==========================================

// GET: Obtener eventos de una novia específica
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
                description: row.description,
                link: row.link
            }
        }));
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Crear o Actualizar Evento
app.post('/api/events', async (req, res) => {
    const ev = req.body;
    
    if (!ev.title || !ev.start || !ev.brideId) {
        return res.status(400).json({ error: "Faltan datos obligatorios (title, start, brideId)" });
    }

    const id = ev.id || Date.now().toString();
    const target = ev.extendedProps?.target || ev.target || 'General';
    const desc = ev.extendedProps?.description || ev.description || '';
    const deadline = ev.extendedProps?.deadline || ev.deadline || '';
    const link = ev.extendedProps?.link || ev.link || '';

    const sql = `
        INSERT INTO events (id, title, start, color, brideId, target, deadline, description, link) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            start = excluded.start,
            color = excluded.color,
            target = excluded.target,
            deadline = excluded.deadline,
            description = excluded.description,
            link = excluded.link
    `;

    try {
        await db.execute({
            sql: sql,
            args: [id, ev.title, ev.start, ev.color, ev.brideId, target, deadline, desc, link]
        });
        res.json({ success: true, id: id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 6. RUTAS API: CHECKLIST (TAREAS)
// ==========================================

app.get('/api/checklist/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.execute({
            sql: "SELECT * FROM checklist WHERE user_id = ? ORDER BY id DESC",
            args: [userId]
        });
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checklist', async (req, res) => {
    try {
        const { userId, text, priority } = req.body;
        const result = await db.execute({
            sql: "INSERT INTO checklist (user_id, task_text, priority) VALUES (?, ?, ?)",
            args: [userId, text, priority || 'Normal']
        });
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/checklist/:id', async (req, res) => {
    try {
        const { completed } = req.body;
        await db.execute({
            sql: "UPDATE checklist SET is_completed = ? WHERE id = ?",
            args: [completed ? 1 : 0, req.params.id]
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/checklist/:id', async (req, res) => {
    try {
        await db.execute({ sql: "DELETE FROM checklist WHERE id = ?", args: [req.params.id] });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 7. RUTAS API: PROVEEDORES Y RECOMENDACIONES
// ==========================================

// MATCHMAKING: Recomendados para la novia
app.get('/api/recommendations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. Perfil Novia
        const perfilRes = await db.execute({ sql: "SELECT * FROM wedding_profiles WHERE user_id = ?", args: [userId] });
        const perfil = perfilRes.rows[0];

        // 2. Todos los proveedores
        const provRes = await db.execute("SELECT * FROM proveedores");
        const proveedores = provRes.rows;

        if (!perfil) return res.json({ success: true, data: proveedores }); 

        // 3. Algoritmo
        const recomendados = proveedores.map(p => {
            let score = 0;
            const costo = p.costo || 0;
            const maxItemBudget = (perfil.budget_limit || 0) * 0.40;
            
            if (costo <= maxItemBudget) score += 50;

            if (perfil.estilos_preferidos && p.estilo) {
                const estilosNovia = perfil.estilos_preferidos.toLowerCase();
                const estiloProv = p.estilo.toLowerCase();
                if (estilosNovia.split(',').some(e => estiloProv.includes(e.trim()))) score += 50;
            }
            return { ...p, score };
        });

        recomendados.sort((a, b) => b.score - a.score);
        res.json({ success: true, data: recomendados });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardar proveedor seleccionado
app.post('/api/proveedores/seleccionar', async (req, res) => {
    try {
        const { userId, proveedorId } = req.body;
        await db.execute({
            sql: "INSERT INTO proveedores_seleccionados (user_id, proveedor_id) VALUES (?, ?)",
            args: [userId, proveedorId]
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 8. RUTAS API: DOCUMENTOS E INVITADOS
// ==========================================

app.post('/api/documentos', async (req, res) => {
    try {
        const { userId, fileName, fileType, fileUrl, eventId } = req.body;
        await db.execute({
            sql: "INSERT INTO documentos (dueño_id, nombre_archivo, tipo, url, event_id, compartido_planner) VALUES (?, ?, ?, ?, ?, 1)",
            args: [userId, fileName, fileType, fileUrl, eventId || null]
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guests/:userId', async (req, res) => {
    try {
        const rs = await db.execute({ sql: "SELECT * FROM guests WHERE user_id = ?", args: [req.params.userId] });
        res.json({ success: true, data: rs.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/guests', async (req, res) => {
    try {
        const { userId, name } = req.body;
        await db.execute({ sql: "INSERT INTO guests (user_id, name) VALUES (?, ?)", args: [userId, name] });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 9. RUTAS API: ALERTAS Y PRESUPUESTO
// ==========================================

app.post('/api/profile', async (req, res) => {
    try {
        const { userId, weddingDate, budgetLimit, estilos } = req.body;
        await db.execute({
            sql: `INSERT INTO wedding_profiles (user_id, wedding_date, budget_limit, estilos_preferidos) 
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(user_id) DO UPDATE SET 
                  wedding_date=excluded.wedding_date, budget_limit=excluded.budget_limit, estilos_preferidos=excluded.estilos_preferidos`,
            args: [userId, weddingDate, budgetLimit, estilos || '']
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/pay', async (req, res) => {
    try {
        const { id, amount } = req.body;
        const current = await db.execute({ sql: "SELECT total_cost, paid_amount FROM budget WHERE id = ?", args: [id] });
        if (current.rows.length === 0) return res.json({ success: false });

        const item = current.rows[0];
        const newPaid = (item.paid_amount || 0) + parseFloat(amount);
        const newStatus = newPaid >= item.total_cost ? 'Pagado' : 'Pendiente';

        await db.execute({
            sql: "UPDATE budget SET paid_amount = ?, status = ? WHERE id = ?",
            args: [newPaid, newStatus, id]
        });
        res.json({ success: true, newPaid, newStatus });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 10. CHATBOT IA (Multirole)
// ==========================================

app.post('/api/ia/chat', async (req, res) => {
    const { messages, message, isNovia, userName, fileData, saveToInbox, summaryData, role } = req.body;

    // A. Guardar en Inbox Planner
    if (saveToInbox && summaryData) {
        plannerInbox.push({
            id: Date.now(),
            type: fileData ? 'document' : 'insight',
            category: summaryData.category || 'General',
            text: summaryData.text,
            user: userName || 'Usuario',
            date: new Date().toISOString().split('T')[0]
        });
        return res.json({ success: true, response: "¡Listo! Información guardada en el Dashboard." });
    }

    try {
        let ultimoMensaje = "";
        if (messages && messages.length > 0) ultimoMensaje = messages[messages.length - 1].content;
        else if (message) ultimoMensaje = message;
        else return res.json({ success: false, response: "..." });

        let systemInstruction = "";

        // B. Contexto según Rol
        if (role === 'guest') {
            systemInstruction = "Eres un asistente para invitados de una boda. Responde dudas sobre vestimenta, ubicación o regalos de forma amable.";
        } else if (role === 'planner' || role === 'admin') {
            systemInstruction = "Eres el Asistente Ejecutivo de la Wedding Planner Andrea Figueroa. Responde de forma técnica y profesional.";
        } else {
            // Contexto personalizado para cada Novia
            const nombreNovia = userName || "Novia";
            systemInstruction = `Eres 'AF Virtual', asistente personal de la novia ${nombreNovia}. Eres amable, entusiasta, ayudas a calmar nervios y das tips de boda personalizados.`;
        }

        const promptParts = [{ text: systemInstruction }, { text: `Usuario: ${ultimoMensaje}` }];
        if (fileData) promptParts.push(fileData);

        if (!chatModel) return res.json({ success: true, response: "IA iniciando..." });

        const result = await chatModel.generateContent(promptParts);
        res.json({ success: true, response: result.response.text() });

    } catch (error) {
        console.error("Gemini Error:", error);
        res.json({ success: true, response: "Tuve un problema de conexión. ¿Intenta de nuevo?" });
    }
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`\n✨ SERVER CORRIENDO EN PUERTO: ${PORT}`);
    console.log(`👥 Usuarios Enterprise cargados: ${users.length}`);
});