import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';

export async function inicializarBaseDeDatos() {
    try {
        const client = await pool.connect();
        console.log("🔌 Conectando a PostgreSQL (Neon)...");

        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'novia',
            name TEXT
        )`);

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

        await client.query(`CREATE TABLE IF NOT EXISTS documentos (
            id SERIAL PRIMARY KEY,
            nombre_archivo TEXT,
            tipo TEXT,
            url TEXT,
            compartido_planner BOOLEAN DEFAULT FALSE,
            dueño_id TEXT,
            event_id TEXT
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT,
            start_date TEXT,
            color TEXT,
            brideId TEXT,
            target TEXT,
            deadline TEXT,
            description TEXT,
            link TEXT
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS guests (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            name TEXT,
            status TEXT DEFAULT 'Pendiente'
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS wedding_profiles (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            wedding_date TEXT,
            budget_limit NUMERIC,
            estilos_preferidos TEXT,
            invitados_estimados INTEGER,
            partner_name TEXT,
            avatar TEXT
        )`);

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

        await client.query(`CREATE TABLE IF NOT EXISTS checklist (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            task_text TEXT,
            is_completed BOOLEAN DEFAULT FALSE,
            priority TEXT DEFAULT 'Normal'
        )`);

        await client.query(`CREATE TABLE IF NOT EXISTS proveedores_seleccionados (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            proveedor_id INTEGER REFERENCES proveedores(id),
            estado TEXT DEFAULT 'Contratado'
        )`);

        const userCount = await client.query("SELECT COUNT(*) FROM users");
        if (parseInt(userCount.rows[0].count) === 0) {
            console.log("🌱 Inicializando usuarios por defecto...");
            const defaultUsers = [
                { id: 'planner_andrea', email: 'planner@andreafigueroa.com', password: 'plannercustommer_123', role: 'planner', name: 'Andrea Figueroa' },
                { id: 'novia_erika', email: 'earrobalopez@gmail.com', password: 'Gabi9090', role: 'novia', name: 'Erika Arroba' }
            ];
            for (const u of defaultUsers) {
                const hash = await bcrypt.hash(u.password, 10);
                await client.query(
                    "INSERT INTO users (id, email, password, role, name) VALUES ($1, $2, $3, $4, $5)",
                    [u.id, u.email, hash, u.role, u.name]
                );
                if (u.role === 'novia') {
                    await client.query("INSERT INTO wedding_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [u.id]);
                }
            }
        }

        client.release();
        console.log("✅ Tablas sincronizadas con NEON (PostgreSQL).");
    } catch (error) {
        console.error("❌ Error inicializando BD:", error);
    }
}