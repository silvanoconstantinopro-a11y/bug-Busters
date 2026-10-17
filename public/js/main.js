// ============================================================================
// Bug Busters — utilitários partilhados do frontend
// ============================================================================
const API = '/api/v1';

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro na comunicação.');
  return data;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------
async function loadServices(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  try {
    const services = await api('/services');
    el.innerHTML = services.map(s => `
      <div class="card">
        <div class="icon">${s.icon || '💡'}</div>
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(s.description)}</p>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Equipa — fotos reais com fallback para iniciais
// ---------------------------------------------------------------------------
async function loadTeam(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  try {
    const team = await api('/team');
    el.innerHTML = team.map(t => {
      const initial = (t.name || '?').trim().charAt(0).toUpperCase();
      const safeName = escapeHtml(t.name);
      const safeRole = escapeHtml(t.role);
      const safeBio  = escapeHtml(t.biography || '');

      const photoHtml = t.photo_url
        ? `<img src="${escapeHtml(t.photo_url)}"
                alt="Fotografia de ${safeName}"
                class="team-photo"
                loading="lazy"
                onerror="this.outerHTML='<div class=&quot;team-photo team-photo-fallback&quot;>${initial}</div>'" />`
        : `<div class="team-photo team-photo-fallback">${initial}</div>`;

      const linkedinHtml = t.linkedin_url
        ? `<p class="team-linkedin">
             <a href="${escapeHtml(t.linkedin_url)}" target="_blank" rel="noopener">LinkedIn →</a>
           </p>`
        : '';

      return `
        <div class="card team-card">
          ${photoHtml}
          <h3>${safeName}</h3>
          <p class="team-role">${safeRole}</p>
          <p>${safeBio}</p>
          ${linkedinHtml}
        </div>
      `;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Portfólio
// ---------------------------------------------------------------------------
async function loadPortfolio(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  try {
    const items = await api('/portfolio');
    el.innerHTML = items.map(p => `
      <div class="card">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.summary)}</p>
        ${p.technologies ? `<p class="portfolio-tech">${escapeHtml(p.technologies)}</p>` : ''}
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Configurações públicas
// ---------------------------------------------------------------------------
async function loadSettings() {
  try {
    const s = await api('/settings');

    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (s[key]) el.textContent = s[key];
    });

    document.querySelectorAll('[data-whatsapp]').forEach(el => {
      if (s.company_whatsapp) {
        const num = String(s.company_whatsapp).replace(/[^\d]/g, '');
        el.href = `https://wa.me/${num}`;
      }
    });

    document.querySelectorAll('[data-setting-href]').forEach(el => {
      const key = el.dataset.settingHref;
      if (s[key]) el.href = s[key];
    });
  } catch (_) { /* silencioso */ }
}

// ---------------------------------------------------------------------------
// Realçar link activo
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname;
  document.querySelectorAll('nav.menu a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
});