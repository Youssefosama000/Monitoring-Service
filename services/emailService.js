require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');
const db         = require('../database/db');

const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendDownAlert(target, errorMessage) {
    const detectedAt = new Date().toUTCString();
    const subject    = `[ALERT] Your ${target.target_type.toLowerCase()} ${target.target} is DOWN`;

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <div style="background:#e74c3c;padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;">Downtime Alert</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
            <p>Hello,</p>
            <p>One of your monitored targets is currently <strong style="color:#e74c3c;">unreachable</strong>:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr style="background:#fff;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;width:40%;">Target</td><td style="padding:10px 16px;">${target.target}</td></tr>
                <tr style="background:#f5f5f5;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;">Type</td><td style="padding:10px 16px;">${target.target_type}</td></tr>
                <tr style="background:#fff;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;">Protocol</td><td style="padding:10px 16px;">${target.protocol}</td></tr>
                <tr style="background:#f5f5f5;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;">Status</td><td style="padding:10px 16px;color:#e74c3c;"><strong>DOWN</strong></td></tr>
                <tr style="background:#fff;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;">Detected At</td><td style="padding:10px 16px;">${detectedAt}</td></tr>
                <tr style="background:#f5f5f5;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;">Error</td><td style="padding:10px 16px;color:#c0392b;">${errorMessage || 'Unknown error'}</td></tr>
            </table>
            <p>We will continue monitoring and notify you when it recovers.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#888;font-size:12px;">Alamar Monitoring</p>
        </div>
    </div>`;

    const text = `DOWNTIME ALERT\n\nTarget: ${target.target}\nType: ${target.target_type}\nStatus: DOWN\nDetected At: ${detectedAt}\nError: ${errorMessage || 'Unknown error'}\n\nWe will notify you when it recovers.\n\n-- Alamar Monitoring`;

    await sendEmail(target, subject, html, text, 'DOWN');
}

async function sendRecoveryAlert(target) {
    const recoveredAt = new Date().toUTCString();
    const subject     = `[RESOLVED] Your ${target.target_type.toLowerCase()} ${target.target} is back UP`;

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <div style="background:#27ae60;padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;">Service Recovered</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
            <p>Hello,</p>
            <p>Your monitored target is <strong style="color:#27ae60;">back online</strong>:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr style="background:#fff;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;width:40%;">Target</td><td style="padding:10px 16px;">${target.target}</td></tr>
                <tr style="background:#f5f5f5;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;">Status</td><td style="padding:10px 16px;color:#27ae60;"><strong>UP</strong></td></tr>
                <tr style="background:#fff;border:1px solid #eee;"><td style="padding:10px 16px;font-weight:bold;color:#555;">Recovered At</td><td style="padding:10px 16px;">${recoveredAt}</td></tr>
            </table>
            <p>Monitoring continues as normal.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#888;font-size:12px;">Alamar Monitoring</p>
        </div>
    </div>`;

    const text = `SERVICE RECOVERED\n\nTarget: ${target.target}\nStatus: UP\nRecovered At: ${recoveredAt}\n\nMonitoring continues as normal.\n\n-- Alamar Monitoring`;

    await sendEmail(target, subject, html, text, 'RECOVERED');
}

async function sendEmail(target, subject, html, text, emailType) {
    let deliveryStatus = 'SENT';
    let errorMsg       = null;

    try {
        await transporter.sendMail({
            from: `"Alamar Monitoring" <${process.env.EMAIL_FROM}>`,
            to:      target.notification_email,
            subject,
            html,
            text,
        });
    } catch (err) {
        deliveryStatus = 'FAILED';
        errorMsg       = err.message;
        console.error(`Email failed for target ${target.id}:`, err.message);
    }

    try {
        await db.query(
            `INSERT INTO alert_emails_log (target_id, recipient_email, email_type, subject, delivery_status, error_message)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [target.id, target.notification_email, emailType, subject, deliveryStatus, errorMsg]
        );
    } catch (logErr) {
        console.error('Failed to log email:', logErr.message);
    }
}

module.exports = { sendDownAlert, sendRecoveryAlert };
