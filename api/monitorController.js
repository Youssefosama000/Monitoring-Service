const db = require('../database/db');
const { validateTarget } = require('../utils/targetValidator');

exports.create = async (req, res) => {
    const {
        target,
        target_type,
        notification_email,
        protocol = 'HTTP',
        port = null,
        check_interval_seconds = 60,
    } = req.body;

    const customerId = req.customerId;

    const validationError = validateTarget(target, target_type);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        const result = await db.query(
            `INSERT INTO monitored_targets
                (customer_id, target, target_type, protocol, port, notification_email, check_interval_seconds)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [customerId, target, target_type, protocol, port, notification_email, check_interval_seconds]
        );
        return res.status(201).json({ data: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This target is already being monitored.' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.list = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM monitored_targets WHERE customer_id = $1 ORDER BY created_at DESC`,
            [req.customerId]
        );
        return res.json({ data: result.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getOne = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM monitored_targets WHERE id = $1 AND customer_id = $2`,
            [req.params.id, req.customerId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });
        return res.json({ data: result.rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.update = async (req, res) => {
    const { notification_email, check_interval_seconds, is_active } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (notification_email !== undefined)      { fields.push(`notification_email = $${idx++}`);      values.push(notification_email); }
    if (check_interval_seconds !== undefined)  { fields.push(`check_interval_seconds = $${idx++}`);  values.push(check_interval_seconds); }
    if (is_active !== undefined)               { fields.push(`is_active = $${idx++}`);               values.push(is_active); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields provided to update' });

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id, req.customerId);

    try {
        const result = await db.query(
            `UPDATE monitored_targets SET ${fields.join(', ')} WHERE id = $${idx++} AND customer_id = $${idx} RETURNING *`,
            values
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });
        return res.json({ data: result.rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.remove = async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM monitored_targets WHERE id = $1 AND customer_id = $2 RETURNING id`,
            [req.params.id, req.customerId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });
        return res.json({ message: 'Monitor deleted successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getHistory = async (req, res) => {
    const limit  = parseInt(req.query.limit)  || 50;
    const offset = parseInt(req.query.offset) || 0;

    try {
        const ownerCheck = await db.query(
            `SELECT id FROM monitored_targets WHERE id = $1 AND customer_id = $2`,
            [req.params.id, req.customerId]
        );
        if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });

        const result = await db.query(
            `SELECT * FROM status_history WHERE target_id = $1 ORDER BY checked_at DESC LIMIT $2 OFFSET $3`,
            [req.params.id, limit, offset]
        );
        return res.json({ data: result.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
