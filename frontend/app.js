const API = '/api/monitors';

let monitors = [];

async function apiFetch(path, options = {}) {
    const res  = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...options });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.errors?.[0]?.msg || 'Request failed');
    return json;
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    const titles = { dashboard: 'Dashboard', monitors: 'My Monitors', add: 'Add Monitor', history: 'History' };
    document.getElementById('page-title').textContent = titles[page] || page;
    if (page === 'dashboard') loadDashboard();
    if (page === 'monitors')  loadMonitorCards();
    if (page === 'history')   loadHistoryPage();
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); showPage(item.dataset.page); });
});

async function loadDashboard() {
    try {
        const { data } = await apiFetch('');
        monitors = data;
        renderDashboard();
    } catch (err) { console.error(err); }
}

function renderDashboard() {
    const up    = monitors.filter(m => m.current_status === 'UP').length;
    const down  = monitors.filter(m => m.current_status === 'DOWN').length;
    const total = monitors.length;
    document.getElementById('stat-up').textContent     = up;
    document.getElementById('stat-down').textContent   = down;
    document.getElementById('stat-total').textContent  = total;
    document.getElementById('stat-uptime').textContent = total > 0 ? `${Math.round((up / total) * 100)}%` : '—';

    const tbody = document.getElementById('monitors-tbody');
    if (monitors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-row">No monitors yet. <a href="#" onclick="showPage('add')">Add one</a></td></tr>`;
        return;
    }
    tbody.innerHTML = monitors.map(m => `
        <tr>
            <td><strong>${esc(m.target)}</strong></td>
            <td>${esc(m.target_type)}</td>
            <td><span class="proto-badge">${esc(m.protocol)}${m.port ? ':' + m.port : ''}</span></td>
            <td>${statusBadge(m.current_status)}</td>
            <td>${m.response_time_ms != null ? `<span style="color:${rtColor(m.response_time_ms)}">${m.response_time_ms} ms</span>` : '<span style="color:#94a3b8">—</span>'}</td>
            <td style="color:#64748b;font-size:13px;">${esc(m.notification_email)}</td>
            <td style="color:#64748b;font-size:12px;">${m.last_checked_at ? timeAgo(m.last_checked_at) : 'Never'}</td>
            <td>
                <button class="action-btn" onclick="openDetail(${m.id})">Details</button>
                <button class="action-btn danger" onclick="deleteMonitor(${m.id})">Delete</button>
            </td>
        </tr>`).join('');
    document.getElementById('last-refresh').textContent = 'Updated just now';
}

async function loadMonitorCards() {
    try {
        const { data } = await apiFetch('');
        monitors = data;
        const container = document.getElementById('monitors-cards');
        if (monitors.length === 0) { container.innerHTML = `<p style="color:#94a3b8;padding:24px;">No monitors yet.</p>`; return; }
        container.innerHTML = monitors.map(m => `
            <div class="monitor-card ${m.current_status === 'DOWN' ? 'down-card' : 'up-card'}" onclick="openDetail(${m.id})">
                <div class="monitor-card-title"><span>${esc(m.target)}</span>${statusBadge(m.current_status)}</div>
                <div class="monitor-card-sub">${esc(m.target_type)} · ${esc(m.protocol)}${m.port ? ':' + m.port : ''}</div>
                <div style="font-size:12px;color:#64748b;">Alert: ${esc(m.notification_email)}</div>
                <div class="monitor-card-footer">
                    <span>Checked ${m.last_checked_at ? timeAgo(m.last_checked_at) : 'never'}</span>
                    <span>${m.response_time_ms != null ? m.response_time_ms + ' ms' : '—'}</span>
                </div>
            </div>`).join('');
    } catch (err) { console.error(err); }
}

document.getElementById('f-protocol').addEventListener('change', function () {
    document.getElementById('port-group').style.display = this.value === 'TCP' ? 'flex' : 'none';
});

async function submitMonitor(e) {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    const okEl  = document.getElementById('form-success');
    errEl.style.display = 'none';
    okEl.style.display  = 'none';

    const body = {
        target:                 document.getElementById('f-target').value.trim(),
        target_type:            document.getElementById('f-type').value,
        protocol:               document.getElementById('f-protocol').value,
        notification_email:     document.getElementById('f-email').value.trim(),
        check_interval_seconds: parseInt(document.getElementById('f-interval').value),
    };
    const port = document.getElementById('f-port').value;
    if (port) body.port = parseInt(port);

    try {
        await apiFetch('', { method: 'POST', body: JSON.stringify(body) });
        okEl.textContent   = `Monitor for "${body.target}" added successfully!`;
        okEl.style.display = 'block';
        document.getElementById('add-monitor-form').reset();
        document.getElementById('port-group').style.display = 'none';
        setTimeout(() => showPage('dashboard'), 1500);
    } catch (err) {
        errEl.textContent   = err.message;
        errEl.style.display = 'block';
    }
}

async function loadHistoryPage() {
    try {
        const { data } = await apiFetch('');
        monitors = data;
        const sel = document.getElementById('history-target-select');
        sel.innerHTML = '<option value="">Select a monitor...</option>' +
            monitors.map(m => `<option value="${m.id}">${esc(m.target)} (${esc(m.protocol)})</option>`).join('');
    } catch (err) { console.error(err); }
}

async function loadHistory() {
    const targetId = document.getElementById('history-target-select').value;
    const tbody    = document.getElementById('history-tbody');
    if (!targetId) { tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Select a monitor to view history</td></tr>`; return; }
    try {
        const { data } = await apiFetch(`/${targetId}/history`);
        if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="empty-row">No history available yet</td></tr>`; return; }
        tbody.innerHTML = data.map(r => `
            <tr>
                <td style="font-size:13px;color:#64748b;">${formatDate(r.checked_at)}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${r.response_time_ms != null ? `<span style="color:${rtColor(r.response_time_ms)}">${r.response_time_ms} ms</span>` : '—'}</td>
                <td>${r.http_status_code ? `<span class="proto-badge">${r.http_status_code}</span>` : '—'}</td>
                <td style="color:#ef4444;font-size:13px;">${esc(r.error_message || '—')}</td>
            </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-row" style="color:#ef4444;">${err.message}</td></tr>`;
    }
}

async function openDetail(id) {
    const m = monitors.find(x => x.id === id);
    if (!m) return;
    document.getElementById('modal-title').textContent = m.target;
    document.getElementById('modal-body').innerHTML = `
        <div class="modal-detail-row"><span class="label">Status</span>${statusBadge(m.current_status)}</div>
        <div class="modal-detail-row"><span class="label">Target</span>${esc(m.target)}</div>
        <div class="modal-detail-row"><span class="label">Type</span>${esc(m.target_type)}</div>
        <div class="modal-detail-row"><span class="label">Protocol</span><span class="proto-badge">${esc(m.protocol)}${m.port ? ':' + m.port : ''}</span></div>
        <div class="modal-detail-row"><span class="label">Alert Email</span>${esc(m.notification_email)}</div>
        <div class="modal-detail-row"><span class="label">Check Interval</span>${m.check_interval_seconds}s</div>
        <div class="modal-detail-row"><span class="label">Response Time</span>${m.response_time_ms != null ? m.response_time_ms + ' ms' : '—'}</div>
        <div class="modal-detail-row"><span class="label">Last Checked</span>${m.last_checked_at ? formatDate(m.last_checked_at) : 'Never'}</div>
        <div class="modal-detail-row"><span class="label">Added On</span>${formatDate(m.created_at)}</div>`;
    document.getElementById('modal-delete-btn').onclick = () => {
        deleteMonitor(id);
        document.getElementById('detail-modal').classList.remove('open');
    };
    document.getElementById('detail-modal').classList.add('open');
}

function closeModal(e) {
    if (e.target.id === 'detail-modal') document.getElementById('detail-modal').classList.remove('open');
}

async function deleteMonitor(id) {
    if (!confirm('Are you sure you want to delete this monitor?')) return;
    try {
        await apiFetch(`/${id}`, { method: 'DELETE' });
        monitors = monitors.filter(m => m.id !== id);
        renderDashboard();
    } catch (err) { alert(err.message); }
}

function statusBadge(status) {
    const s   = (status || 'UNKNOWN').toUpperCase();
    const cls = s === 'UP' ? 'up' : s === 'DOWN' ? 'down' : 'unknown';
    return `<span class="status-badge ${cls}">${s}</span>`;
}

function rtColor(ms) {
    if (ms < 200) return '#22c55e';
    if (ms < 600) return '#f59e0b';
    return '#ef4444';
}

function timeAgo(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(iso) { return new Date(iso).toLocaleString(); }

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadDashboard();
setInterval(() => {
    if (document.getElementById('page-dashboard').classList.contains('active')) loadDashboard();
}, 30000);
