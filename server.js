import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pg from 'pg'; 

const { Pool } = pg;

// Carga el .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// ==========================================
// 1. CONFIGURACIÓN BASE DE DATOS 
// ==========================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    }
});
const query = async (text, params) => await pool.query(text, params);

async function inicializarBaseDeDatos() {
    try {
        const client = await pool.connect();
        console.log("🔌 Conectando a PostgreSQL...");

        // --- 1. Tabla Proveedores ---
        // Nota: AUTOINCREMENT cambia a SERIAL
        await client.query(`CREATE TABLE IF NOT EXISTS proveedores (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            tipo TEXT NOT NULL,
            presupuesto TEXT NOT NULL,
            estilo TEXT,
            contacto TEXT,
            descripcion TEXT,
            costo INTEGER
        )`);

        // --- 2. Tabla Documentos ---
        await client.query(`CREATE TABLE IF NOT EXISTS documentos (
            id SERIAL PRIMARY KEY,
            nombre_archivo TEXT,
            tipo TEXT, 
            url TEXT,
            compartido_planner BOOLEAN DEFAULT FALSE,
            dueño_id TEXT,
            event_id TEXT
        )`);

        // --- 3. Tabla Eventos (Calendario) ---
        await client.query(`CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT,
            start_date TEXT, -- 'start' es palabra reservada a veces, mejor start_date o dejarlo entre comillas
            color TEXT,
            brideId TEXT,
            target TEXT,
            deadline TEXT,
            description TEXT,
            link TEXT
        )`);

        // --- 4. Tabla Invitados ---
        await client.query(`CREATE TABLE IF NOT EXISTS guests (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            name TEXT,
            status TEXT DEFAULT 'Pendiente'
        )`);

        // --- 5. Perfil de Boda ---

        await client.query(`CREATE TABLE IF NOT EXISTS wedding_profiles (
            user_id TEXT PRIMARY KEY,
            wedding_date TEXT,
            budget_limit NUMERIC,
            estilos_preferidos TEXT,
            invitados_estimados INTEGER,
            partner_name TEXT,
            avatar TEXT
        )`);

        try {
            await client.query("ALTER TABLE wedding_profiles ADD COLUMN IF NOT EXISTS avatar TEXT");
            await client.query("ALTER TABLE wedding_profiles ADD COLUMN IF NOT EXISTS partner_name TEXT");
        } catch (e) { /* Ignorar si ya existen */ }

        // --- 6. Presupuesto ---
        await client.query(`CREATE TABLE IF NOT EXISTS budget (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            category TEXT,
            item_name TEXT,
            estimated_cost NUMERIC,
            final_cost NUMERIC DEFAULT 0,
            paid_amount NUMERIC DEFAULT 0,
            status TEXT DEFAULT 'Pendiente'
        )`);

        // --- 7. Checklist ---
        await client.query(`CREATE TABLE IF NOT EXISTS checklist (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            task_text TEXT,
            is_completed BOOLEAN DEFAULT FALSE,
            priority TEXT DEFAULT 'Normal'
        )`);

        // --- 8. Proveedores Seleccionados ---
        await client.query(`CREATE TABLE IF NOT EXISTS proveedores_seleccionados (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            proveedor_id INTEGER,
            estado TEXT DEFAULT 'Contratado',
            FOREIGN KEY(proveedor_id) REFERENCES proveedores(id)
        )`);

        client.release();
        console.log("✅ Tablas sincronizadas con NEON (PostgreSQL) correctamente.");
    } catch (error) {
        console.error("❌ Error inicializando tablas en Postgres:", error);
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

// 3. USSERS
const users = [
    { id: 'planner_andrea', email: 'planner@andreafigueroa.com', password: 'plannercustommer_123', role: 'planner', full_name: 'Andrea Figueroa' },
    { id: 'novia_erika', email: 'earrobalopez@gmail.com', password: 'Gabi9090', role: 'novia', full_name: 'Erika Arroba' },
    { id: 'novia_maria', email: 'maria.gonzalez@boda.com', password: 'mariaBoda2026', role: 'novia', full_name: 'María González' },
    { id: 'novia_isabella', email: 'isabella.rojas@future.com', password: 'isaYjuan2025', role: 'novia', full_name: 'Isabella Rojas' },
    { id: 'novia_carla', email: 'carla.ruiz@wedding.com', password: 'ruizBoda99', role: 'novia', full_name: 'Carla Ruiz' },
    { id: 'novia_sofia', email: 'sofia.martinez@email.com', password: 'sofiaLove23', role: 'novia', full_name: 'Sofía Martínez' },
    { id: 'novia_valentina', email: 'valentina.lopez@dream.com', password: 'valeDiosa', role: 'novia', full_name: 'Valentina López' },
    { id: 'novia_lucia', email: 'lucia.fer@mail.com', password: 'lucil120', role: 'novia', full_name: 'Lucía Fer' }
];

let plannerInbox = []; 

// ==========================================
// 4. RUTAS API: AUTENTICACIÓN Y ADMIN
// ==========================================

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        res.json({ success: true, userId: user.id, role: user.role, name: user.full_name });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales incorrectas.' });
    }
});

app.get('/api/admin/proveedores', async (req, res) => {
    try {
        const result = await query("SELECT * FROM proveedores");
        const data = result.rows.map(p => ({ ...p, estilo: p.estilo ? p.estilo.split(',') : [] }));
        res.json({ data: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. RUTAS API: CALENDARIO (Postgres Version)
// ==========================================

app.get('/api/events', async (req, res) => {
    const { brideId } = req.query;
    try {
        // En Postgres usamos $1 en vez de ?
        const result = await query("SELECT * FROM events WHERE brideId = $1", [brideId]);
        
        const events = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            start: row.start_date, // Mapeamos start_date de BD a start del frontend
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

app.post('/api/events', async (req, res) => {
    const ev = req.body;
    
    if (!ev.title || !ev.start || !ev.brideId) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    const id = ev.id || Date.now().toString();
    const target = ev.extendedProps?.target || ev.target || 'General';
    const desc = ev.extendedProps?.description || ev.description || '';
    const deadline = ev.extendedProps?.deadline || ev.deadline || '';
    const link = ev.extendedProps?.link || ev.link || '';

    // Sintaxis Postgres para UPSERT (Insert or Update)
    // Se usan $1, $2, etc. en orden
    const sql = `
        INSERT INTO events (id, title, start_date, color, brideId, target, deadline, description, link) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            start_date = excluded.start_date,
            color = excluded.color,
            target = excluded.target,
            deadline = excluded.deadline,
            description = excluded.description,
            link = excluded.link
    `;

    try {
        await query(sql, [id, ev.title, ev.start, ev.color, ev.brideId, target, deadline, desc, link]);
        res.json({ success: true, id: id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 6. RUTAS API: CHECKLIST
// ==========================================

app.get('/api/checklist/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await query("SELECT * FROM checklist WHERE user_id = $1 ORDER BY id DESC", [userId]);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/checklist', async (req, res) => {
    try {
        const { userId, text, priority } = req.body;
        // Postgres necesita RETURNING id para devolver el ID creado
        const result = await query(
            "INSERT INTO checklist (user_id, task_text, priority) VALUES ($1, $2, $3) RETURNING id", 
            [userId, text, priority || 'Normal']
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/checklist/:id', async (req, res) => {
    try {
        const { completed } = req.body;
        // Postgres acepta true/false directamente para booleanos
        await query("UPDATE checklist SET is_completed = $1 WHERE id = $2", [completed, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/checklist/:id', async (req, res) => {
    try {
        await query("DELETE FROM checklist WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 7. RUTAS API: PROVEEDORES
// ==========================================

app.get('/api/recommendations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const perfilRes = await query("SELECT * FROM wedding_profiles WHERE user_id = $1", [userId]);
        const perfil = perfilRes.rows[0];

        const provRes = await query("SELECT * FROM proveedores");
        const proveedores = provRes.rows;

        if (!perfil) return res.json({ success: true, data: proveedores }); 

        const recomendados = proveedores.map(p => {
            let score = 0;
            const costo = parseFloat(p.costo) || 0;
            const budgetLimit = parseFloat(perfil.budget_limit) || 0;
            const maxItemBudget = budgetLimit * 0.40;
            
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

app.post('/api/proveedores/seleccionar', async (req, res) => {
    try {
        const { userId, proveedorId } = req.body;
        await query(
            "INSERT INTO proveedores_seleccionados (user_id, proveedor_id) VALUES ($1, $2)",
            [userId, proveedorId]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 8. RUTAS API: DOCUMENTOS E INVITADOS
// ==========================================

app.post('/api/documentos', async (req, res) => {
    try {
        const { userId, fileName, fileType, fileUrl, eventId } = req.body;
        await query(
            "INSERT INTO documentos (dueño_id, nombre_archivo, tipo, url, event_id, compartido_planner) VALUES ($1, $2, $3, $4, $5, TRUE)",
            [userId, fileName, fileType, fileUrl, eventId || null]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guests/:userId', async (req, res) => {
    try {
        const rs = await query("SELECT * FROM guests WHERE user_id = $1", [req.params.userId]);
        res.json({ success: true, data: rs.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const userRes = await query("SELECT name FROM users WHERE id = $1", [userId]);
        const profileRes = await query("SELECT * FROM wedding_profiles WHERE user_id = $1", [userId]);
        
        if (userRes.rows.length > 0) {
            const nombre = userRes.rows[0].name;
            const perfil = profileRes.rows[0] || {};
            
            res.json({ 
                success: true, 
                user: { 
                    name: nombre,
                    wedding_date: perfil.wedding_date,
                    budget: perfil.budget_limit
                } 
            });
        } else {
            res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/guests', async (req, res) => {
    try {
        const { userId, name } = req.body;
        await query("INSERT INTO guests (user_id, name) VALUES ($1, $2)", [userId, name]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 9. RUTAS API: ALERTAS Y PRESUPUESTO
// ==========================================

app.post('/api/profile', async (req, res) => {
    try {
        const { userId, weddingDate, budgetLimit, estilos } = req.body;
        await query(`
            INSERT INTO wedding_profiles (user_id, wedding_date, budget_limit, estilos_preferidos) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT(user_id) DO UPDATE SET 
            wedding_date=excluded.wedding_date, 
            budget_limit=excluded.budget_limit, 
            estilos_preferidos=excluded.estilos_preferidos`,
            [userId, weddingDate, budgetLimit, estilos || '']
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budget/pay', async (req, res) => {
    try {
        const { id, amount } = req.body;
        const current = await query("SELECT estimated_cost, paid_amount FROM budget WHERE id = $1", [id]);
        
        if (current.rows.length === 0) return res.json({ success: false });

        const item = current.rows[0];
        const newPaid = (parseFloat(item.paid_amount) || 0) + parseFloat(amount);
        const newStatus = newPaid >= parseFloat(item.estimated_cost) ? 'Pagado' : 'Pendiente';

        await query(
            "UPDATE budget SET paid_amount = $1, status = $2 WHERE id = $3",
            [newPaid, newStatus, id]
        );
        res.json({ success: true, newPaid, newStatus });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 10. CHATBOT IA (Multirole) - (Igual que antes)
// ==========================================

app.get('/api/alerts/:userId', (req, res) => {
    res.json([]); 
});

app.post('/api/ia/chat', async (req, res) => {
    const { messages, message, isNovia, userName, fileData, saveToInbox, summaryData, role } = req.body;

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

        if (role === 'guest') {
            systemInstruction = "Eres un asistente para invitados de una boda. Responde dudas sobre vestimenta, ubicación o regalos de forma amable.";
        } else if (role === 'planner' || role === 'admin') {
            systemInstruction = "Eres el Asistente Ejecutivo de la Wedding Planner Andrea Figueroa. Responde de forma técnica y profesional.";
        } else {
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
// RUTA PERFIL DE NOVIA
// ==========================================
app.post('/api/guardar-perfil', async (req, res) => {
    try {
        // 1. Recibimos los datos
        const { userId, nombre, pareja, fecha_boda, presupuesto, estilo, avatarBase64 } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: "Falta el ID de usuario" });
        }

        // 2. Guardamos los datos de la boda en 'wedding_profiles'
        const sqlPerfil = `
            INSERT INTO wedding_profiles (user_id, wedding_date, budget_limit, estilos_preferidos, partner_name, avatar)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT(user_id) DO UPDATE SET 
                wedding_date = excluded.wedding_date,
                budget_limit = excluded.budget_limit,
                estilos_preferidos = excluded.estilos_preferidos,
                partner_name = excluded.partner_name,
                avatar = excluded.avatar
        `;
        
        await query(sqlPerfil, [userId, fecha_boda, presupuesto, estilo, pareja, avatarBase64]);

        // 3. ¡NUEVO! Actualizamos también el nombre en la tabla 'users'
        // Esto asegura que "Bienvenida, [Nombre]" funcione
        if (nombre) {
            const sqlUsuario = `UPDATE users SET name = $1 WHERE id = $2`;
            await query(sqlUsuario, [nombre, userId]);
        }

        console.log(`✅ Perfil y nombre actualizados para: ${userId}`);
        
        // 4. Devolvemos el nombre en la respuesta para que el frontend lo use
        res.json({ 
            success: true, 
            message: "Perfil guardado correctamente",
            user: { name: nombre } // Devolvemos el nombre actualizado
        });

    } catch (e) {
        console.error("Error guardando perfil:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`\n✨ SERVER CORRIENDO EN PUERTO: ${PORT}`);
    console.log(`🚀 Conectado a Neon (PostgreSQL)`);
    console.log(`👥 Usuarios Enterprise cargados: ${users.length}`);
});