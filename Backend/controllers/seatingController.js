import { pool } from '../config/db.js';

// ==============================================================
// 1. GESTIÓN DE MESAS
// ==============================================================

// Obtener todas las mesas con sus invitados y asientos asignados
export const getTables = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const queryText = `
            SELECT 
                t.id AS table_id,
                t.table_number,
                t.capacity,
                t.location,
                COUNT(sa.id) AS assigned_count,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'seat_id', sa.id,
                        'seat_number', sa.seat_number,
                        'guest_id', g.id,
                        'guest_name', g.name
                    )
                ) FILTER (WHERE sa.id IS NOT NULL) AS seats
            FROM tables t
            LEFT JOIN seat_assignments sa ON t.id = sa.table_id
            LEFT JOIN guests g ON sa.guest_id = g.id
            WHERE t.user_id = $1
            GROUP BY t.id, t.table_number, t.capacity, t.location
            ORDER BY t.table_number ASC;
        `;
        const result = await pool.query(queryText, [userId]);

        res.status(200).json({
            success: true,
            tables: result.rows
        });
    } catch (error) {
        console.error('Error al obtener mesas:', error);
        res.status(500).json({ success: false, message: 'Error interno al consultar mesas.' });
    }
};

// Crear una nueva mesa
export const createTable = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { table_number, capacity, location } = req.body;

        if (!table_number || !capacity) {
            return res.status(400).json({ success: false, message: 'Número de mesa y capacidad son requeridos.' });
        }

        const result = await pool.query(
            `INSERT INTO tables (user_id, table_number, capacity, location) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, table_number, capacity, location || 'Principal']
        );

        res.status(201).json({
            success: true,
            message: 'Mesa creada correctamente.',
            table: result.rows[0]
        });
    } catch (error) {
        console.error('Error al crear mesa:', error);
        res.status(500).json({ success: false, message: 'Error al registrar la mesa.' });
    }
};

// ==============================================================
// 2. ASIGNACIÓN DE ASIENTOS
// ==============================================================

// Asignar o cambiar un invitado de mesa/asiento
export const assignSeat = async (req, res) => {
    try {
        const { table_id, guest_id, seat_number } = req.body;

        if (!table_id || !guest_id || !seat_number) {
            return res.status(400).json({ success: false, message: 'Faltan datos de la asignación.' });
        }

        // Validación backend: Verificar si la mesa superó su capacidad máxima
        const capacityCheck = await pool.query(
            `SELECT t.capacity, COUNT(sa.id) AS occupied
             FROM tables t
             LEFT JOIN seat_assignments sa ON t.id = sa.table_id
             WHERE t.id = $1
             GROUP BY t.capacity`,
            [table_id]
        );

        if (capacityCheck.rows.length > 0) {
            const { capacity, occupied } = capacityCheck.rows[0];
            if (parseInt(occupied) >= parseInt(capacity)) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Capacidad máxima superada. La mesa solo permite ${capacity} personas.` 
                });
            }
        }

        // Asignar asiento (ON CONFLICT actualiza si el invitado ya tenía otro asiento)
        const queryText = `
            INSERT INTO seat_assignments (table_id, guest_id, seat_number)
            VALUES ($1, $2, $3)
            ON CONFLICT (guest_id) 
            DO UPDATE SET table_id = EXCLUDED.table_id, seat_number = EXCLUDED.seat_number
            RETURNING *;
        `;
        const result = await pool.query(queryText, [table_id, guest_id, seat_number]);

        res.status(200).json({
            success: true,
            message: 'Invitado asignado al asiento exitosamente.',
            assignment: result.rows[0]
        });
    } catch (error) {
        console.error('Error al asignar asiento:', error);
        res.status(500).json({ success: false, message: 'Error al procesar la asignación de asiento.' });
    }
};

// ==============================================================
// 3. RESTRICCIONES ALIMENTICIAS (BANQUETERÍA / CATERING)
// ==============================================================

// Registrar restricción alimenticia a un invitado
export const addDietaryRestriction = async (req, res) => {
    try {
        const { guest_id, restriction_name } = req.body;

        if (!guest_id || !restriction_name) {
            return res.status(400).json({ success: false, message: 'Invitado y restricción son obligatorios.' });
        }

        // Obtener o crear la restricción en el catálogo
        let restriction = await pool.query(
            "SELECT id FROM dietary_restrictions WHERE LOWER(name) = LOWER($1)", 
            [restriction_name]
        );

        let restrictionId;
        if (restriction.rows.length === 0) {
            const newRest = await pool.query(
                "INSERT INTO dietary_restrictions (name) VALUES ($1) RETURNING id", 
                [restriction_name]
            );
            restrictionId = newRest.rows[0].id;
        } else {
            restrictionId = restriction.rows[0].id;
        }

        // Vincular con el invitado
        await pool.query(
            "INSERT INTO guest_dietary_restrictions (guest_id, restriction_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [guest_id, restrictionId]
        );

        res.status(201).json({
            success: true,
            message: 'Restricción alimenticia registrada correctamente.'
        });
    } catch (error) {
        console.error('Error al agregar restricción alimenticia:', error);
        res.status(500).json({ success: false, message: 'Error al registrar la restricción.' });
    }
};

// Consolidado de restricciones para el banquetero/catering
export const getDietaryReport = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        const queryText = `
            SELECT 
                dr.name AS restriccion,
                COUNT(gdr.guest_id) AS total_invitados,
                ARRAY_AGG(g.name) AS invitados
            FROM guest_dietary_restrictions gdr
            JOIN dietary_restrictions dr ON gdr.restriction_id = dr.id
            JOIN guests g ON gdr.guest_id = g.id
            WHERE g.user_id = $1
            GROUP BY dr.name;
        `;
        const result = await pool.query(queryText, [userId]);

        res.status(200).json({
            success: true,
            report: result.rows
        });
    } catch (error) {
        console.error('Error al consultar reporte de dietas:', error);
        res.status(500).json({ success: false, message: 'Error al generar el reporte alimenticio.' });
    }
};