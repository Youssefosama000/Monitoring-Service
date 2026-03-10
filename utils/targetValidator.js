const IP_REGEX = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function validateTarget(target, type) {
    if (type === 'IP' && !IP_REGEX.test(target)) {
        return 'Invalid IP address format. Example: 192.168.1.1';
    }
    if (type === 'DOMAIN' && !DOMAIN_REGEX.test(target)) {
        return 'Invalid domain format. Example: example.com';
    }
    return null;
}

module.exports = { validateTarget };
