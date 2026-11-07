import { pool } from '../config/db.js';

// 1. Obtener tareas y calcular avance del novio/usuario autenticado
export const getChecklist = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;

        // Obtener tareas del usuario
        const result = await pool.query(
            "SELECT * FROM checklist WHERE user_id = $1 ORDER BY id DESC", 
            [userId]
        );

        // Calcular porcentaje de avance para la UI
        const total = result.rows.length;
        const completed = result.rows.filter(task => task.is_completed).length;
        const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        res.json({
            success: true,
            tasks: result.rows,
            stats: {
                total,
                completed,
                completionPercentage
            }
        });
    } catch (e) {
        console.error("Error al obtener checklist:", e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// 2. Crear una nueva tarea vinculada al usuario autenticado
export const createChecklist = async (req, res) => {
    try {
        const userId = req.user.id || req.user.userId;
        const { text, priority } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, message: 'El texto de la tarea es obligatorio.' });
        }

        const result = await pool.query(
            "INSERT INTO checklist (user_id, task_text, priority) VALUES ($1, $2, $3) RETURNING *", 
            [userId, text, priority || 'Normal']
        );

        res.status(201).json({ 
            success: true, 
            task: result.rows[0] 
        });
    } catch (e) {
        console.error("Error al crear tarea:", e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// 3. Actualizar estado de la tarea (Ejecuta en BD el trigger 'trg_verificar_cierre')
export const updateChecklist = async (req, res) => {
    try {
        const { id } = req.params;
        const { completed } = req.body;
        const userId = req.user.id || req.user.userId;

        // Actualizar tarea verificando propiedad del usuario
        const result = await pool.query(
            "UPDATE checklist SET is_completed = $1 WHERE id = $2 AND user_id = $3 RETURNING *", 
            [completed, id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Tarea no encontrada o sin autorización.' });
        }

        // Consultar porcentaje actualizado tras la modificación
        const statsQuery = await pool.query(
            "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_completed = TRUE) AS completed FROM checklist WHERE user_id = $1",
            [userId]
        );
        const { total, completed: totalCompleted } = statsQuery.rows[0];
        const completionPercentage = total > 0 ? Math.round((totalCompleted / total) * 100) : 0;

        res.json({ 
            success: true, 
            task: result.rows[0],
            completionPercentage,
            isWeddingCompleted: completionPercentage === 100
        });
    } catch (e) {
        console.error("Error al actualizar tarea:", e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// 4. Eliminar una tarea del checklist
export const deleteChecklist = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id || req.user.userId;

        const result = await pool.query(
            "DELETE FROM checklist WHERE id = $1 AND user_id = $2 RETURNING id", 
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Tarea no encontrada o sin autorización.' });
        }

        res.json({ success: true, message: 'Tarea eliminada correctamente.' });
    } catch (e) {
        console.error("Error al eliminar tarea:", e);
        res.status(500).json({ success: false, error: e.message });
    }
};