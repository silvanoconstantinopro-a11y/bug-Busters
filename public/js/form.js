let currentStep = 1;
const formData = { client: {}, project: {}, privacy_consent: false };

function showStep(n) {
  currentStep = n;
  document.querySelectorAll('.form-step').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.step) === n);
  });
  document.querySelectorAll('.step-indicator .step').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.step) === n);
  });
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  collectStep(currentStep);
  showStep(currentStep + 1);
  if (currentStep === 3) renderReview();
}

function prevStep() {
  if (currentStep > 1) showStep(currentStep - 1);
}

function validateStep(n) {
  const errorEl = document.getElementById('form-error');
  errorEl.style.display = 'none';
  const required = [];
  if (n === 1) {
    if (!val('full_name')) required.push('Nome completo');
    if (!val('phone')) required.push('Número de WhatsApp');
    if (!val('country')) required.push('País');
  }
  if (n === 2) {
    if (!val('title')) required.push('Tema do projecto');
    if (!val('objective') || val('objective').length < 10) required.push('Objectivo (mín. 10 caracteres)');
    if (!val('description') || val('description').length < 20) required.push('Descrição (mín. 20 caracteres)');
  }
  if (required.length) {
    errorEl.textContent = 'Preencha: ' + required.join(', ');
    errorEl.style.display = 'block';
    return false;
  }
  return true;
}

function val(id) { return (document.getElementById(id)?.value || '').trim(); }

function collectStep(n) {
  if (n === 1) {
    formData.client = {
      full_name: val('full_name'),
      email: val('email'),
      country_code: document.getElementById('country_code').value,
      phone: val('phone'),
      country: val('country'),
      city: val('city'),
      organization: val('organization'),
    };
  } else if (n === 2) {
    formData.project = {
      title: val('title'),
      objective: val('objective'),
      description: val('description'),
      project_type: document.getElementById('project_type').value,
      client_category: document.getElementById('client_category').value,
      industry: val('industry'),
      budget_range: val('budget_range'),
      desired_deadline: val('desired_deadline'),
      current_stage: val('current_stage'),
    };
  } else if (n === 3) {
    formData.privacy_consent = document.getElementById('privacy_consent').checked;
  }
}

function renderReview() {
  const el = document.getElementById('review-content');
  const c = formData.client, p = formData.project;
  el.innerHTML = `
    <h3 style="margin-bottom:0.8rem">Dados pessoais</h3>
    <p><strong>Nome:</strong> ${escapeHtml(c.full_name)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(c.email || '—')}</p>
    <p><strong>WhatsApp:</strong> ${escapeHtml((c.country_code || '') + ' ' + c.phone)}</p>
    <p><strong>Localização:</strong> ${escapeHtml(c.city ? c.city + ', ' : '')}${escapeHtml(c.country)}</p>
    <p><strong>Organização:</strong> ${escapeHtml(c.organization || '—')}</p>
    <h3 style="margin:1.5rem 0 0.8rem">Projecto</h3>
    <p><strong>Tema:</strong> ${escapeHtml(p.title)}</p>
    <p><strong>Objectivo:</strong> ${escapeHtml(p.objective)}</p>
    <p><strong>Tipo:</strong> ${escapeHtml(p.project_type)}</p>
    <p><strong>Categoria:</strong> ${escapeHtml(p.client_category)}</p>
    <p><strong>Descrição:</strong> ${escapeHtml(p.description)}</p>
  `;
}

async function submitForm(e) {
  e.preventDefault();
  if (!validateStep(3)) return;
  collectStep(3);
  const errorEl = document.getElementById('form-error');
  errorEl.style.display = 'none';
  try {
    const data = await api('/requests', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    // Guardar token para página de confirmação
    sessionStorage.setItem('bb_confirmation', JSON.stringify(data));
    location.href = '/confirmacao.html';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('request-form');
  if (form) form.addEventListener('submit', submitForm);
});