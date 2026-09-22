import { query } from '../config/db.js';

export const getChecklist = async (req, res) => {
    try {
        const result = await query("SELECT * FROM checklist WHERE user_id = $1 ORDER BY id DESC", [req.params.userId]);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const createChecklist = async (req, res) => {
    try {
        const { userId, text, priority } = req.body;
        const result = await query(
            "INSERT INTO checklist (user_id, task_text, priority) VALUES ($1, $2, $3) RETURNING id", 
            [userId, text, priority || 'Normal']
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const updateChecklist = async (req, res) => {
    try {
        await query("UPDATE checklist SET is_completed = $1 WHERE id = $2", [req.body.completed, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deleteChecklist = async (req, res) => {
    try {
        await query("DELETE FROM checklist WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};