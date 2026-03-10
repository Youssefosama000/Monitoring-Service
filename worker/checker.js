const axios           = require('axios');
const net             = require('net');
const { exec }        = require('child_process');
const { promisify }   = require('util');

const execAsync = promisify(exec);

async function check(target) {
    const { protocol, target: host, port, timeout_seconds } = target;
    const timeoutMs = (timeout_seconds || 10) * 1000;

    switch (protocol) {
        case 'HTTP':  return checkHttp(`http://${host}`,  timeoutMs);
        case 'HTTPS': return checkHttp(`https://${host}`, timeoutMs);
        case 'PING':  return checkPing(host, timeoutMs);
        case 'TCP':   return checkTcp(host, port, timeoutMs);
        default:      return checkHttp(`http://${host}`,  timeoutMs);
    }
}

async function checkHttp(url, timeoutMs) {
    const start = Date.now();
    try {
        const response = await axios.get(url, {
            timeout: timeoutMs,
            maxRedirects: 5,
            validateStatus: (status) => status < 500,
            headers: { 'User-Agent': 'AlamarMonitor/1.0' },
        });
        return { success: true, responseTime: Date.now() - start, httpStatus: response.status, error: null };
    } catch (err) {
        let errorMessage = 'Unknown error';
        if (err.code === 'ECONNREFUSED')                          errorMessage = 'Connection refused';
        else if (err.code === 'ENOTFOUND')                        errorMessage = 'DNS resolution failed';
        else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') errorMessage = 'Connection timed out';
        else if (err.response)                                    errorMessage = `HTTP ${err.response.status} Server Error`;
        else                                                      errorMessage = err.message;

        return { success: false, responseTime: Date.now() - start, httpStatus: err.response?.status || null, error: errorMessage };
    }
}

async function checkPing(host, timeoutMs) {
    const start      = Date.now();
    const timeoutSec = Math.ceil(timeoutMs / 1000);
    const isWindows  = process.platform === 'win32';
    const cmd        = isWindows
        ? `ping -n 1 -w ${timeoutMs} ${host}`
        : `ping -c 1 -W ${timeoutSec} ${host}`;

    try {
        await execAsync(cmd, { timeout: timeoutMs + 2000 });
        return { success: true, responseTime: Date.now() - start, httpStatus: null, error: null };
    } catch {
        return { success: false, responseTime: Date.now() - start, httpStatus: null, error: 'Host unreachable (ping failed)' };
    }
}

async function checkTcp(host, port, timeoutMs) {
    const start = Date.now();
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const cleanup = (success, errorMsg = null) => {
            socket.destroy();
            resolve({ success, responseTime: Date.now() - start, httpStatus: null, error: errorMsg });
        };
        socket.setTimeout(timeoutMs);
        socket.connect(port, host, () => cleanup(true));
        socket.on('timeout', () => cleanup(false, 'TCP connection timed out'));
        socket.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') cleanup(false, `Port ${port} is closed`);
            else if (err.code === 'ENOTFOUND') cleanup(false, 'DNS resolution failed');
            else cleanup(false, err.message);
        });
    });
}

module.exports = { check };
