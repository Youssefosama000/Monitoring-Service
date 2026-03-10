require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db           = require('../database/db');
const checker      = require('./checker');
const emailService = require('../services/emailService');

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 10;

async function runWorker() {
    console.log(`[${new Date().toISOString()}] Worker cycle started`);

    const { rows: targets } = await db.query(`
        SELECT * FROM monitored_targets
        WHERE is_active = TRUE
          AND (
              last_checked_at IS NULL
              OR last_checked_at + (check_interval_seconds * INTERVAL '1 second') <= NOW()
          )
        LIMIT 200
    `);

    if (targets.length === 0) {
        console.log('No targets due for checking.');
        return;
    }

    console.log(`Checking ${targets.length} target(s)...`);

    for (let i = 0; i < targets.length; i += WORKER_CONCURRENCY) {
        const batch = targets.slice(i, i + WORKER_CONCURRENCY);
        await Promise.all(batch.map(target => processTarget(target)));
    }

    console.log('Cycle complete.');
}

async function processTarget(target) {
    const previousStatus = target.current_status;
    let checkResult;

    try {
        checkResult = await checker.check(target);
    } catch (err) {
        checkResult = { success: false, error: err.message, responseTime: null, httpStatus: null };
    }

    const newStatus          = checkResult.success ? 'UP' : 'DOWN';
    const consecutiveFailures = checkResult.success ? 0 : target.consecutive_failures + 1;

    const shouldAlert = !checkResult.success &&
        consecutiveFailures >= target.failure_threshold &&
        previousStatus !== 'DOWN';

    const shouldSendRecovery = checkResult.success && previousStatus === 'DOWN';

    const statusChanged = newStatus !== previousStatus && previousStatus !== 'UNKNOWN';

    const effectiveStatus = !checkResult.success && consecutiveFailures < target.failure_threshold
        ? previousStatus
        : newStatus;

    await db.query(
        `UPDATE monitored_targets SET
            current_status        = $1,
            consecutive_failures  = $2,
            last_checked_at       = $3,
            last_status_change_at = CASE WHEN $4 THEN NOW() ELSE last_status_change_at END,
            updated_at            = NOW()
         WHERE id = $5`,
        [effectiveStatus, consecutiveFailures, new Date(), statusChanged, target.id]
    );

    await db.query(
        `INSERT INTO status_history (target_id, status, response_time_ms, error_message, http_status_code)
         VALUES ($1, $2, $3, $4, $5)`,
        [target.id, newStatus, checkResult.responseTime, checkResult.error || null, checkResult.httpStatus || null]
    );

    if (shouldAlert)        await emailService.sendDownAlert(target, checkResult.error);
    if (shouldSendRecovery) await emailService.sendRecoveryAlert(target);
}

runWorker().catch(err => {
    console.error('Worker fatal error:', err);
    process.exit(1);
});

module.exports = { runWorker };
