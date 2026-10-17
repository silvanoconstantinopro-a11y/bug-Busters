let currentPage = 'dashboard';

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------
async function guard() {
  try {
    const me = await api('/auth/me');
    document.getElementById('admin-user').textContent = me.fullName || me.email;
  } catch {
    location.href = '/login.html';
  }
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch (_) {}
  location.href = '/login.html';
}

// ---------------------------------------------------------------------------
// Etiquetas e badges
// ---------------------------------------------------------------------------
const STATUS_LABELS = {
  new: 'Novo', under_review: 'Em análise', awaiting_client: 'Aguardando cliente',
  quote_sent: 'Orçamento enviado', approved: 'Aprovado',
  in_development: 'Em desenvolvimento', completed: 'Concluído', cancelled: 'Cancelado',
};

function statusBadge(s) {
  const map = {
    new: 'badge-new', under_review: 'badge-review', awaiting_client: 'badge-await',
    quote_sent: 'badge-quote', approved: 'badge-approved', in_development: 'badge-dev',
    completed: 'badge-done', cancelled: 'badge-cancelled',
  };
  return `<span class="badge ${map[s] || 'badge-new'}">${STATUS_LABELS[s] || s}</span>`;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function loadDashboard() {
  const data = await api('/admin/dashboard');
  const byStatus = Object.fromEntries(data.byStatus.map(r => [r.status, Number(r.c)]));
  document.getElementById('admin-content').innerHTML = `
    <h1>Painel</h1>
    <div class="stats">
      <div class="stat"><div class="value">${data.total}</div><div class="label">Total de pedidos</div></div>
      <div class="stat"><div class="value">${byStatus.new || 0}</div><div class="label">Novos</div></div>
      <div class="stat"><div class="value">${byStatus.under_review || 0}</div><div class="label">Em análise</div></div>
      <div class="stat"><div class="value">${byStatus.in_development || 0}</div><div class="label">Em desenvolvimento</div></div>
      <div class="stat"><div class="value">${byStatus.completed || 0}</div><div class="label">Concluídos</div></div>
    </div>
    <h2 style="margin-bottom:1rem">Pedidos recentes</h2>
    ${data.recent.length === 0
      ? '<div class="alert alert-info">Sem pedidos recentes.</div>'
      : `<table>
          <thead><tr><th>Referência</th><th>Cliente</th><th>Tema</th><th>Estado</th><th>Data</th></tr></thead>
          <tbody>
            ${data.recent.map(r => `
              <tr onclick="openRequest(${r.id})" style="cursor:pointer">
                <td><strong>${escapeHtml(r.reference)}</strong></td>
                <td>${escapeHtml(r.client_name)}</td>
                <td>${escapeHtml(r.title)}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${escapeHtml(r.created_at)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
  `;
}

// ---------------------------------------------------------------------------
// Solicitações — LISTA com filtros
// ---------------------------------------------------------------------------
async function loadRequests() {
  const qInput      = document.getElementById('filter-q');
  const statusInput = document.getElementById('filter-status');
  const typeInput   = document.getElementById('filter-type');
  const tableEl     = document.getElementById('requests-table');

  if (!tableEl) {
    console.warn('loadRequests: #requests-table ainda não está no DOM');
    return;
  }

  const params = new URLSearchParams();
  if (qInput?.value)      params.set('q', qInput.value);
  if (statusInput?.value) params.set('status', statusInput.value);
  if (typeInput?.value)   params.set('type', typeInput.value);

  let rows;
  try {
    rows = await api('/admin/requests?' + params.toString());
    console.log('Solicitações recebidas:', rows.length);
  } catch (e) {
    console.error('loadRequests erro:', e);
    tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
    return;
  }

  if (!rows || rows.length === 0) {
    tableEl.innerHTML = '<div class="alert alert-info">Não há solicitações.</div>';
    return;
  }

  tableEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Referência</th><th>Cliente</th><th>Tema</th>
          <th>Tipo</th><th>Estado</th><th>Prioridade</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr onclick="openRequest(${r.id})" style="cursor:pointer">
            <td><strong>${escapeHtml(r.reference)}</strong></td>
            <td>${escapeHtml(r.client_name)}</td>
            <td>${escapeHtml(r.title)}</td>
            <td>${escapeHtml(r.project_type)}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${escapeHtml(r.priority)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  `;
}

function loadRequestsPage() {
  document.getElementById('admin-content').innerHTML = `
    <h1>Solicitações</h1>
    <div class="toolbar">
      <input id="filter-q" placeholder="Pesquisar nome, tema ou referência..." />
      <select id="filter-status">
        <option value="">Todos os estados</option>
        ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <select id="filter-type">
        <option value="">Todos os tipos</option>
        <option value="web">Web</option>
        <option value="mobile">Mobile</option>
        <option value="web_mobile">Web e Mobile</option>
        <option value="other">Outro</option>
      </select>
    </div>
    <div id="requests-table"><div class="alert alert-info">A carregar...</div></div>
  `;

  // Ligar eventos DEPOIS de o HTML existir
  document.getElementById('filter-q').addEventListener('input', loadRequests);
  document.getElementById('filter-status').addEventListener('change', loadRequests);
  document.getElementById('filter-type').addEventListener('change', loadRequests);

  // Adiar a chamada para o próximo tick — o browser já processou o innerHTML
  return Promise.resolve().then(() => loadRequests());
}

// ---------------------------------------------------------------------------
// Detalhe de um pedido
// ---------------------------------------------------------------------------
async function openRequest(id) {
  const [r, hist] = await Promise.all([
    api('/admin/requests/' + id),
    api(`/admin/requests/${id}/history`),
  ]);

  const statusOptions = Object.entries(STATUS_LABELS).map(([k, v]) =>
    `<option value="${k}" ${k === r.status ? 'selected' : ''}>${v}</option>`).join('');
  const priorityOptions = ['low', 'normal', 'high', 'urgent'].map(p =>
    `<option value="${p}" ${p === r.priority ? 'selected' : ''}>${p}</option>`).join('');

  document.getElementById('admin-content').innerHTML = `
    <a href="#" onclick="showPage('requests');return false;">← Voltar</a>
    <h1 style="margin-top:1rem">${escapeHtml(r.reference)} — ${escapeHtml(r.title)}</h1>
    <div class="grid grid-2" style="margin-top:1.5rem">
      <div class="card">
        <h3>Cliente</h3>
        <p><strong>${escapeHtml(r.client_name)}</strong></p>
        <p>${escapeHtml(r.client_email || '—')}</p>
        <p>${escapeHtml(r.client_phone)}</p>
        <p>${escapeHtml((r.city ? r.city + ', ' : '') + (r.country || ''))}</p>
        ${r.organization ? `<p>${escapeHtml(r.organization)}</p>` : ''}
        <a class="btn btn-outline" style="margin-top:1rem" target="_blank"
           href="https://wa.me/${(r.client_phone || '').replace(/[^\d]/g, '')}">Contactar via WhatsApp</a>
      </div>
      <div class="card">
        <h3>Projecto</h3>
        <p><strong>Objectivo:</strong> ${escapeHtml(r.objective)}</p>
        <p style="margin-top:0.8rem"><strong>Descrição:</strong> ${escapeHtml(r.description)}</p>
        <p style="margin-top:0.8rem"><strong>Tipo:</strong> ${escapeHtml(r.project_type)} · <strong>Categoria:</strong> ${escapeHtml(r.client_category)}</p>
      </div>
    </div>
    <div class="card" style="margin-top:1.5rem">
      <h3>Gestão</h3>
      <div class="field-row" style="margin-top:1rem">
        <div class="field"><label>Estado</label><select id="edit-status">${statusOptions}</select></div>
        <div class="field"><label>Prioridade</label><select id="edit-priority">${priorityOptions}</select></div>
      </div>
      <div class="field">
        <label>Comentário interno (opcional)</label>
        <input id="edit-comment" placeholder="Motivo da alteração..." />
      </div>
      <button class="btn btn-primary" onclick="saveRequest(${r.id})">Guardar alterações</button>
    </div>
    <h2 style="margin:2rem 0 1rem">Histórico</h2>
    ${hist.length === 0
      ? '<div class="alert alert-info">Sem histórico.</div>'
      : `<table>
          <thead><tr><th>Data</th><th>De</th><th>Para</th><th>Por</th><th>Comentário</th></tr></thead>
          <tbody>
            ${hist.map(h => `
              <tr>
                <td>${escapeHtml(h.created_at)}</td>
                <td>${h.previous_status ? (STATUS_LABELS[h.previous_status] || h.previous_status) : '—'}</td>
                <td>${STATUS_LABELS[h.new_status] || h.new_status}</td>
                <td>${escapeHtml(h.changed_by_name || 'Sistema')}</td>
                <td>${escapeHtml(h.comment || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
  `;
}

async function saveRequest(id) {
  const body = {
    status: document.getElementById('edit-status').value,
    priority: document.getElementById('edit-priority').value,
    comment: document.getElementById('edit-comment').value || null,
  };
  await api('/admin/requests/' + id, { method: 'PATCH', body: JSON.stringify(body) });
  alert('Alterações guardadas.');
  openRequest(id);
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
async function loadClients() {
  const rows = await api('/admin/clients');
  document.getElementById('admin-content').innerHTML = `
    <h1>Clientes</h1>
    ${rows.length === 0
      ? '<div class="alert alert-info">Ainda não há clientes.</div>'
      : `<table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>País</th><th>Pedidos</th></tr></thead>
          <tbody>
            ${rows.map(c => `
              <tr>
                <td>${escapeHtml(c.full_name)}</td>
                <td>${escapeHtml(c.email || '—')}</td>
                <td>${escapeHtml((c.country_code || '') + ' ' + c.phone)}</td>
                <td>${escapeHtml(c.country)}</td>
                <td>${c.requests_count}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
  `;
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------
async function loadAudit() {
  const rows = await api('/admin/audit');
  document.getElementById('admin-content').innerHTML = `
    <h1>Auditoria</h1>
    ${rows.length === 0
      ? '<div class="alert alert-info">Sem registos de auditoria.</div>'
      : `<table>
          <thead><tr><th>Data</th><th>Utilizador</th><th>Acção</th><th>Entidade</th></tr></thead>
          <tbody>
            ${rows.map(a => `
              <tr>
                <td>${escapeHtml(a.created_at)}</td>
                <td>${escapeHtml(a.actor_name || '—')}</td>
                <td>${escapeHtml(a.action)}</td>
                <td>${escapeHtml(a.entity)} ${a.entity_id ? '#' + a.entity_id : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
  `;
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------
async function loadSettings() {
  const s = await api('/admin/settings');
  document.getElementById('admin-content').innerHTML = `
    <h1>Configurações</h1>
    <div class="card" style="max-width:600px">
      <div class="field"><label>Nome da empresa</label><input id="set-company_name" value="${escapeHtml(s.company_name || '')}" /></div>
      <div class="field"><label>Slogan</label><input id="set-company_slogan" value="${escapeHtml(s.company_slogan || '')}" /></div>
      <div class="field"><label>WhatsApp comercial</label><input id="set-company_whatsapp" value="${escapeHtml(s.company_whatsapp || '')}" /></div>
      <div class="field"><label>LinkedIn</label><input id="set-company_linkedin" value="${escapeHtml(s.company_linkedin || '')}" /></div>
      <div class="field"><label>E-mail</label><input id="set-company_email" value="${escapeHtml(s.company_email || '')}" /></div>
      <button class="btn btn-primary" onclick="saveSettings()">Guardar</button>
    </div>
  `;
}

async function saveSettings() {
  const body = {};
  ['company_name', 'company_slogan', 'company_whatsapp', 'company_linkedin', 'company_email'].forEach(k => {
    const el = document.getElementById('set-' + k);
    if (el) body[k] = el.value;
  });
  await api('/admin/settings', { method: 'PATCH', body: JSON.stringify(body) });
  alert('Configurações guardadas.');
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------
async function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.admin-sidebar nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  const content = document.getElementById('admin-content');
  if (!content) return;

  try {
    if (page === 'dashboard') return await loadDashboard();
    if (page === 'requests')  return await loadRequestsPage();
    if (page === 'clients')   return await loadClients();
    if (page === 'audit')     return await loadAudit();
    if (page === 'settings')  return await loadSettings();
  } catch (e) {
    console.error('Erro em showPage(' + page + '):', e);
    content.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('admin-content')) return;

  guard().then(() => {
    showPage('dashboard');
    document.querySelectorAll('.admin-sidebar nav a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        showPage(a.dataset.page);
      });
    });
  });
});