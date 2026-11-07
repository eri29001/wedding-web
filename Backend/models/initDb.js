import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';

export async function inicializarBaseDeDatos() {
    try {
        const client = await pool.connect();
        console.log("🔌 Conectando a PostgreSQL (Neon)...");

        // 1. Tabla Usuarios
        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'novia',
            name TEXT,
            reset_password_token TEXT,
            reset_password_expires TIMESTAMP,
            must_change_password BOOLEAN DEFAULT FALSE,
            is_anonymized BOOLEAN DEFAULT FALSE,
            anonymized_at TIMESTAMP WITH TIME ZONE
        )`);

        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS reset_password_token TEXT,
            ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP,
            ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP WITH TIME ZONE;
        `);

        // 2. Tabla Proveedores
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

        // 3. Tabla Documentos
        await client.query(`CREATE TABLE IF NOT EXISTS documentos (
            id SERIAL PRIMARY KEY,
            nombre_archivo TEXT,
            tipo TEXT,
            url TEXT,
            compartido_planner BOOLEAN DEFAULT FALSE,
            dueño_id TEXT,
            event_id TEXT
        )`);

        // 4. Tabla Eventos (Calendario)
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

        // 5. Tabla Invitados
        await client.query(`CREATE TABLE IF NOT EXISTS guests (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            name TEXT,
            status TEXT DEFAULT 'Pendiente'
        )`);

        // 6. Perfil de Boda (con columnas de control de estado y modo solo lectura)
        await client.query(`CREATE TABLE IF NOT EXISTS wedding_profiles (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            wedding_date TEXT,
            budget_limit NUMERIC,
            estilos_preferidos TEXT,
            invitados_estimados INTEGER,
            partner_name TEXT,
            avatar TEXT,
            status VARCHAR(50) DEFAULT 'En Proceso',
            is_read_only BOOLEAN DEFAULT FALSE
        )`);

        await client.query(`
            ALTER TABLE wedding_profiles
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'En Proceso',
            ADD COLUMN IF NOT EXISTS is_read_only BOOLEAN DEFAULT FALSE;
        `);

        // 7. Presupuesto
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

        // 8. Checklist
        await client.query(`CREATE TABLE IF NOT EXISTS checklist (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            task_text TEXT,
            is_completed BOOLEAN DEFAULT FALSE,
            priority TEXT DEFAULT 'Normal'
        )`);

        // 9. Proveedores Seleccionados
        await client.query(`CREATE TABLE IF NOT EXISTS proveedores_seleccionados (
            id SERIAL PRIMARY KEY,
            user_id TEXT,
            proveedor_id INTEGER REFERENCES proveedores(id),
            estado TEXT DEFAULT 'Contratado'
        )`);

        // 10. LOPDP: Registro de Consentimiento Informado
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_consents (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
                policy_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
                terms_accepted BOOLEAN DEFAULT TRUE,
                data_processing_accepted BOOLEAN DEFAULT TRUE,
                consent_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 11. LOPDP: Logs de Auditoría
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                table_name TEXT,
                action_type TEXT,
                record_id TEXT,
                changed_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 12. Módulos Adicionales (Restricciones, Mesas, Incidencias, Reseñas)
        await client.query(`
            CREATE TABLE IF NOT EXISTS dietary_restrictions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS guest_dietary_restrictions (
                guest_id INT REFERENCES guests(id) ON DELETE CASCADE,
                restriction_id INT REFERENCES dietary_restrictions(id) ON DELETE CASCADE,
                PRIMARY KEY (guest_id, restriction_id)
            );

            CREATE TABLE IF NOT EXISTS tables (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                table_number INT NOT NULL,
                capacity INT NOT NULL DEFAULT 10,
                location VARCHAR(100)
            );

            CREATE TABLE IF NOT EXISTS seat_assignments (
                id SERIAL PRIMARY KEY,
                table_id INT REFERENCES tables(id) ON DELETE CASCADE,
                guest_id INT UNIQUE REFERENCES guests(id) ON DELETE CASCADE,
                seat_number INT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS incidents (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                provider_id INT REFERENCES proveedores(id) ON DELETE SET NULL,
                title VARCHAR(150) NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'En Proceso', 'Resuelto')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS provider_reviews (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                provider_id INT REFERENCES proveedores(id) ON DELETE CASCADE,
                rating INT CHECK (rating BETWEEN 1 AND 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, provider_id)
            );
        `);

        // ==============================================================
        // ESTRUCTURAS AVANZADAS POSTGRESQL (TRIGGERS, VISTAS, FUNCIONES)
        // ==============================================================

        // A. Función y Trigger para Presupuesto
        await client.query(`
            CREATE OR REPLACE FUNCTION recalcular_estado_presupuesto()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.paid_amount >= NEW.estimated_cost AND NEW.estimated_cost > 0 THEN
                    NEW.status := 'Pagado';
                ELSIF NEW.paid_amount > 0 THEN
                    NEW.status := 'Parcial';
                ELSE
                    NEW.status := 'Pendiente';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_recalcular_presupuesto ON budget;
            CREATE TRIGGER trg_recalcular_presupuesto
            BEFORE INSERT OR UPDATE ON budget
            FOR EACH ROW
            EXECUTE FUNCTION recalcular_estado_presupuesto();
        `);

        // B. Función y Trigger de Cierre Automático de Boda
        await client.query(`
            CREATE OR REPLACE FUNCTION verificar_cierre_boda()
            RETURNS TRIGGER AS $$
            DECLARE
                v_total_tasks INT;
                v_completed_tasks INT;
            BEGIN
                SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = TRUE)
                INTO v_total_tasks, v_completed_tasks
                FROM checklist
                WHERE user_id = NEW.user_id;

                IF v_total_tasks > 0 AND v_total_tasks = v_completed_tasks THEN
                    UPDATE wedding_profiles
                    SET status = 'Completada',
                        is_read_only = TRUE
                    WHERE user_id = NEW.user_id;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_verificar_cierre ON checklist;
            CREATE TRIGGER trg_verificar_cierre
            AFTER UPDATE OF is_completed ON checklist
            FOR EACH ROW
            EXECUTE FUNCTION verificar_cierre_boda();
        `);

        // C. Vista Consultiva Compleja
        await client.query(`
            CREATE OR REPLACE VIEW v_resumen_novias AS
            SELECT 
                u.id AS user_id,
                u.name AS novia_nombre,
                u.email,
                wp.wedding_date,
                wp.budget_limit AS presupuesto_estimado,
                COALESCE(SUM(b.paid_amount), 0) AS total_pagado,
                COALESCE(SUM(b.estimated_cost), 0) AS total_contratado,
                COUNT(DISTINCT c.id) FILTER (WHERE c.is_completed = TRUE) AS tareas_completadas,
                COUNT(DISTINCT c.id) AS total_tareas
            FROM users u
            LEFT JOIN wedding_profiles wp ON u.id = wp.user_id
            LEFT JOIN budget b ON u.id = b.user_id
            LEFT JOIN checklist c ON u.id = c.user_id
            WHERE u.role = 'novia'
            GROUP BY u.id, u.name, u.email, wp.wedding_date, wp.budget_limit;
        `);

        // D. LOPDP: Procedimiento Almacenado para "Derecho al Olvido"
        await client.query(`
            CREATE OR REPLACE FUNCTION sp_anonimizar_usuario(p_user_id VARCHAR)
            RETURNS VOID AS $$
            BEGIN
                UPDATE users
                SET name = 'Usuario Anonimizado',
                    email = 'deleted_' || p_user_id || '@anon.weddingweb.ec',
                    password = 'ACCOUNT_DELETED',
                    is_anonymized = TRUE,
                    anonymized_at = CURRENT_TIMESTAMP
                WHERE id = p_user_id;

                UPDATE wedding_profiles
                SET partner_name = 'ANONIMO',
                    avatar = NULL
                WHERE user_id = p_user_id;

                INSERT INTO audit_logs(table_name, action_type, record_id, changed_data)
                VALUES ('users', 'LOPDP_ANONYMIZE', p_user_id, '{"status": "Solicitud de Supresión Ejecutada"}'::jsonb);
            END;
            $$ LANGUAGE plpgsql;
        `);

        // ==============================================================
        // SEEDING DE USUARIOS POR DEFECTO
        // ==============================================================
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
        console.log("✅ Tablas, Triggers, Vistas, Funciones LOPDP y Estructuras de Seguridad sincronizadas en NEON (PostgreSQL).");
    } catch (error) {
        console.error("❌ Error inicializando BD:", error);
    }
}