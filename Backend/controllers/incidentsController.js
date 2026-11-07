import { pool } from '../config/db.js';

// 1. Crear una nueva incidencia (Planificadora o Cliente)
export const createIncident = async (req, res) => {
    const { provider_id, title, description, priority, incident_type } = req.body;
    const userId = req.user.id; // Obtenido desde authMiddleware

    if (!title || !description) {
        return res.status(400).json({ message: 'El título y la descripción son obligatorios.' });
    }

    try {
        const query = `
            INSERT INTO incidents (user_id, provider_id, title, description, status)
            VALUES ($1, $2, $3, $4, 'Pendiente')
            RETURNING *;
        `;
        const values = [userId, provider_id || null, title, description];
        const result = await pool.query(query, values);

        // Opcional: Registrar en logs de auditoría (LOPDP)
        await pool.query(
            `INSERT INTO audit_logs (table_name, action_type, record_id, changed_data)
             VALUES ('incidents', 'INCIDENT_CREATED', $1, $2::jsonb)`,
            [result.rows[0].id.toString(), JSON.stringify({ title, priority, incident_type })]
        );

        res.status(201).json({
            message: 'Incidencia registrada exitosamente.',
            incident: result.rows[0]
        });
    } catch (error) {
        console.error('Error al crear incidencia:', error);
        res.status(500).json({ message: 'Error interno del servidor al registrar la incidencia.' });
    }
};

// 2. Respuesta/Descargo del Proveedor (Derecho a réplica)
export const respondToIncident = async (req, res) => {
    const { id } = req.params;
    const { provider_reply, proposed_solution } = req.body;

    if (!provider_reply) {
        return res.status(400).json({ message: 'Debe ingresar una respuesta o descargo.' });
    }

    try {
        const query = `
            UPDATE incidents
            SET description = description || E'\n\n[Respuesta del Proveedor]: ' || $1 || 
                             CASE WHEN $2::text IS NOT NULL THEN E'\n[Propuesta de Solución]: ' || $2 ELSE '' END,
                status = 'En Proceso'
            WHERE id = $3
            RETURNING *;
        `;
        const result = await pool.query(query, [provider_reply, proposed_solution || null, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Incidencia no encontrada.' });
        }

        res.status(200).json({
            message: 'Respuesta registrada correctamente.',
            incident: result.rows[0]
        });
    } catch (error) {
        console.error('Error al responder incidencia:', error);
        res.status(500).json({ message: 'Error interno del servidor al responder la incidencia.' });
    }
};

// 3. Resolver incidencia (Cierre de conformidad por la Planificadora)
export const resolveIncident = async (req, res) => {
    const { id } = req.params;
    const { corrective_action } = req.body;

    try {
        const query = `
            UPDATE incidents
            SET status = 'Resuelto',
                resolved_at = CURRENT_TIMESTAMP,
                description = description || CASE WHEN $1::text IS NOT NULL THEN E'\n\n[Acción Correctiva Acordada]: ' || $1 ELSE '' END
            WHERE id = $2
            RETURNING *;
        `;
        const result = await pool.query(query, [corrective_action || null, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Incidencia no encontrada.' });
        }

        res.status(200).json({
            message: 'Incidencia marcada como Resuelta.',
            incident: result.rows[0]
        });
    } catch (error) {
        console.error('Error al resolver incidencia:', error);
        res.status(500).json({ message: 'Error interno del servidor al cerrar la incidencia.' });
    }
};

// 4. Obtener todas las incidencias de un usuario o boda
export const getIncidentsByUser = async (req, res) => {
    const userId = req.user.id;

    try {
        const query = `
            SELECT i.*, p.nombre AS proveedor_nombre, p.tipo AS proveedor_tipo
            FROM incidents i
            LEFT JOIN proveedores p ON i.provider_id = p.id
            WHERE i.user_id = $1
            ORDER BY i.created_at DESC;
        `;
        const result = await pool.query(query, [userId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener incidencias:', error);
        res.status(500).json({ message: 'Error al consultar las incidencias.' });
    }
};

// 5. Métricas de resolución por proveedor (para Dashboard de Planificadora)
export const getProviderIncidentStats = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id AS provider_id,
                p.nombre AS proveedor_nombre,
                COUNT(i.id) AS total_incidencias,
                COUNT(i.id) FILTER (WHERE i.status = 'Resuelto') AS resueltas,
                COUNT(i.id) FILTER (WHERE i.status = 'Pendiente') AS pendientes
            FROM proveedores p
            LEFT JOIN incidents i ON p.id = i.provider_id
            GROUP BY p.id, p.nombre
            HAVING COUNT(i.id) > 0;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ message: 'Error al calcular métricas de incidencias.' });
    }
};