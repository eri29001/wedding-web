import { query } from '../config/db.js';

export const getEvents = async (req, res) => {
    const { brideId } = req.query;
    try {
        const result = await query("SELECT * FROM events WHERE brideId = $1", [brideId]);
        const events = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            start: row.start_date,
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
};

export const createOrUpdateEvent = async (req, res) => {
    const ev = req.body;
    if (!ev.title || !ev.start || !ev.brideId) {
        return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    const id = ev.id || Date.now().toString();
    const target = ev.extendedProps?.target || ev.target || 'General';
    const desc = ev.extendedProps?.description || ev.description || '';
    const deadline = ev.extendedProps?.deadline || ev.deadline || '';
    const link = ev.extendedProps?.link || ev.link || '';

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
};