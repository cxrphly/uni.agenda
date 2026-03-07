'use strict';

// =============================================
// VARIÁVEIS GLOBAIS
// =============================================
let DB = {};
let paginaAtual = 'dashboard';
let itemEditandoId = null;

// Estado das notificações
let notificationPermission = false;
let notificationTimers = {};

const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// =============================================
// VERIFICAÇÃO DE AUTENTICAÇÃO
// =============================================
async function checkAuth() {
  if (!window.auth) {
    console.log('⛔ Auth não disponível');
    window.location.href = '/login';
    return false;
  }
  
  await window.auth.ensureInitialized();
  
  if (!window.auth.isAuthenticated()) {
    console.log('⛔ Usuário não autenticado');
    window.location.href = '/login';
    return false;
  }
  
  return true;
}

// =============================================
// FUNÇÕES AUXILIARES
// =============================================
function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatarDataCurta(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d} ${MESES[parseInt(m) - 1]}`;
}

function getMateriaNome(id) {
  const m = DB.materias?.find(m => m.id === id);
  return m ? m.nome : 'Sem matéria';
}

function getMateriaCor(id) {
  const m = DB.materias?.find(m => m.id === id);
  return m ? m.cor : '#4f46e5';
}

function getMateriaFaltas(id) {
  const m = DB.materias?.find(m => m.id === id);
  return m ? m.faltas || 0 : 0;
}

function getMateriaMaxFaltas(id) {
  const m = DB.materias?.find(m => m.id === id);
  return m ? m.max_faltas || 0 : 0;
}

function calcularPorcentagemFaltas(materiaId) {
  const faltas = getMateriaFaltas(materiaId);
  const maxFaltas = getMateriaMaxFaltas(materiaId);
  if (maxFaltas === 0) return 0;
  return (faltas / maxFaltas) * 100;
}

function getStatusFaltas(materiaId) {
  const porcentagem = calcularPorcentagemFaltas(materiaId);
  if (porcentagem >= 90) return { class: 'faltas-alert', text: 'Crítico' };
  if (porcentagem >= 70) return { class: 'faltas-warning', text: 'Atenção' };
  return { class: 'faltas-ok', text: 'OK' };
}

function toast(mensagem, tipo = 'success') {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${tipo === 'error' ? 'error' : ''}`;
  toast.textContent = mensagem;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// =============================================
// FUNÇÕES DE NAVEGAÇÃO
// =============================================

function navigateTo(pagina) {
  console.log('Navegando para:', pagina);
  paginaAtual = pagina;

  $$('.page-section').forEach(section => {
    section.classList.add('hidden');
  });

  const sectionAtual = $(`#page-${pagina}`);
  if (sectionAtual) {
    sectionAtual.classList.remove('hidden');
  }

  const titulos = {
    'dashboard': 'Início',
    'agenda': 'Agenda',
    'horarios': 'Grade Horária',
    'tarefas': 'Tarefas',
    'notas': 'Notas',
    'materias': 'Matérias'
  };
  
  const pageTitle = $('#page-title');
  if (pageTitle) pageTitle.textContent = titulos[pagina];

  const btnAddSpan = $('#btn-add span:last-child');
  if (btnAddSpan) {
    const labels = {
      'dashboard': 'Adicionar',
      'agenda': 'Novo Evento',
      'horarios': 'Novo Horário',
      'tarefas': 'Nova Tarefa',
      'notas': 'Nova Nota',
      'materias': 'Nova Matéria'
    };
    btnAddSpan.textContent = labels[pagina];
  }

  $$('.nav-item').forEach(item => {
    if (item.dataset.nav === pagina) {
      item.classList.add('active-nav');
    } else {
      item.classList.remove('active-nav');
    }
  });

  $$('[data-mobile-nav]').forEach(btn => {
    if (btn.dataset.mobileNav === pagina) {
      btn.classList.remove('text-gray-400');
      btn.classList.add('text-primary');
      const span = btn.querySelector('span:last-child');
      if (span) span.classList.add('font-bold');
    } else {
      btn.classList.add('text-gray-400');
      btn.classList.remove('text-primary');
      const span = btn.querySelector('span:last-child');
      if (span) span.classList.remove('font-bold');
    }
  });

  renderPagina(pagina);
}

function renderPagina(pagina) {
  if (!document.getElementById(`page-${pagina}`)) {
    console.warn(`Seção page-${pagina} não encontrada`);
    return;
  }

  if (window.data) {
    DB = window.data.getDB();
  }

  switch (pagina) {
    case 'dashboard': renderDashboard(); break;
    case 'agenda': renderAgenda(); break;
    case 'horarios': renderHorarios(); break;
    case 'tarefas': renderTarefas(); break;
    case 'notas': renderNotas(); break;
    case 'materias': renderMaterias(); break;
  }
}

// =============================================
// FUNÇÕES DE RENDERIZAÇÃO
// =============================================
function renderDashboard() {
  const statEventos = $('#stat-eventos');
  const statTarefas = $('#stat-tarefas');
  const statNotas = $('#stat-notas');
  const statMaterias = $('#stat-materias');
  const dashEventos = $('#dash-eventos');
  const dashTarefas = $('#dash-tarefas');
  const dashTarefasCount = $('#dash-tarefas-count');
  const dashAulas = $('#dash-aulas');
  const dashNotas = $('#dash-notas');

  if (statEventos) statEventos.textContent = DB.eventos?.length || 0;
  if (statTarefas) statTarefas.textContent = DB.tarefas?.filter(t => !t.concluida).length || 0;
  if (statNotas) statNotas.textContent = DB.notas?.length || 0;
  if (statMaterias) statMaterias.textContent = DB.materias?.length || 0;

  if (dashEventos) {
    const eventos = DB.eventos?.slice(0, 3) || [];
    if (eventos.length === 0) {
      dashEventos.innerHTML = '<li class="text-center text-gray-400 py-4">Nenhum evento</li>';
    } else {
      dashEventos.innerHTML = eventos.map(e => `
        <li class="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg" onclick="editarEvento('${e.id}')">
          <div class="w-2 h-10 rounded-full" style="background:${getMateriaCor(e.materia_id)}"></div>
          <div class="flex-1">
            <p class="font-medium text-sm">${e.titulo}</p>
            <p class="text-xs text-gray-400">${formatarDataCurta(e.data)}</p>
          </div>
        </li>
      `).join('');
    }
  }

  if (dashTarefas && dashTarefasCount) {
    const tarefas = DB.tarefas?.filter(t => !t.concluida).slice(0, 3) || [];
    dashTarefasCount.textContent = tarefas.length;
    
    if (tarefas.length === 0) {
      dashTarefas.innerHTML = '<div class="text-center text-gray-400 py-4">Nenhuma tarefa</div>';
    } else {
      dashTarefas.innerHTML = tarefas.map(t => `
        <div class="flex items-center gap-3">
          <input type="checkbox" class="rounded text-primary h-5 w-5" onchange="toggleTarefa('${t.id}')" ${t.concluida ? 'checked' : ''}>
          <span class="text-sm text-gray-700 flex-1">${t.titulo}</span>
          <span class="priority-dot ${t.prioridade === 'alta' ? 'bg-red-500' : t.prioridade === 'media' ? 'bg-yellow-500' : 'bg-green-500'}"></span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full 
                     ${t.prioridade === 'alta' ? 'bg-red-100 text-red-600' : 
                       t.prioridade === 'media' ? 'bg-yellow-100 text-yellow-600' : 
                       'bg-green-100 text-green-600'}">
            ${t.prioridade}
          </span>
        </div>
      `).join('');
    }
  }

  if (dashAulas) {
    const diaHoje = new Date().getDay();
    const aulas = DB.horarios?.filter(h => h.dia_semana === diaHoje).slice(0, 2) || [];
    if (aulas.length === 0) {
      dashAulas.innerHTML = '<div class="text-center text-gray-400 py-4">Nenhuma aula hoje</div>';
    } else {
      dashAulas.innerHTML = aulas.map(a => `
        <div class="p-3 bg-gray-50 rounded-lg flex justify-between items-center border-l-4 cursor-pointer" 
             style="border-left-color: ${getMateriaCor(a.materia_id)}"
             onclick="editarHorario('${a.id}')">
          <div>
            <p class="text-sm font-bold">${getMateriaNome(a.materia_id)}</p>
            <p class="text-xs text-gray-500">${a.hora_inicio} - ${a.hora_fim}</p>
          </div>
        </div>
      `).join('');
    }
  }

  if (dashNotas) {
    const notas = DB.notas?.slice(0, 2) || [];
    if (notas.length === 0) {
      dashNotas.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-4">Nenhuma nota</div>';
    } else {
      dashNotas.innerHTML = notas.map(n => `
        <div class="p-3 rounded-lg cursor-pointer" style="background:${n.cor || '#4f46e5'}20" onclick="editarNota('${n.id}')">
          <p class="text-xs font-bold truncate">${n.titulo}</p>
        </div>
      `).join('');
    }
  }
}

function renderAgenda() {
  const filtroMateriaEvento = $('#filtroMateriaEvento');
  const listaEventos = $('#lista-eventos');

  if (filtroMateriaEvento) {
    popularSelectMaterias('filtroMateriaEvento');
  }
  
  if (listaEventos) {
    if (!DB.eventos || DB.eventos.length === 0) {
      listaEventos.innerHTML = '<div class="text-center text-gray-400 py-12">Nenhum evento cadastrado</div>';
      return;
    }

    listaEventos.innerHTML = DB.eventos.map(e => `
      <div class="flex gap-4 items-center bg-white p-4 rounded-xl border border-gray-100 mb-4 hover:shadow-md">
        <div class="hidden sm:block text-center min-w-[60px]">
          <span class="text-sm font-bold text-primary">${e.data.split('-')[2]}</span>
          <span class="text-xs text-gray-400 block">${MESES[parseInt(e.data.split('-')[1])-1]}</span>
        </div>
        <div class="flex-1" onclick="editarEvento('${e.id}')">
          <h4 class="font-bold">${e.titulo}</h4>
          <p class="text-sm text-gray-500">${getMateriaNome(e.materia_id)} · ${e.hora || '--:--'}</p>
          ${e.descricao ? `<p class="text-xs text-gray-400">${e.descricao}</p>` : ''}
          ${e.notificar ? `<span class="inline-block mt-1 text-xs text-indigo-600">🔔 Lembrete ${e.notificar_minutos}min antes</span>` : ''}
        </div>
        <button class="text-red-500 hover:text-red-700" onclick="excluirEvento('${e.id}')">🗑️</button>
      </div>
    `).join('');
  }
}

function renderTarefas() {
  const filtroMateriaTarefa = $('#filtroMateriaTarefa');
  const filtroPrioridade = $('#filtroPrioridade');
  const filtroStatusTarefa = $('#filtroStatusTarefa');
  const listaTarefas = $('#lista-tarefas');

  if (filtroMateriaTarefa) {
    popularSelectMaterias('filtroMateriaTarefa');
  }
  
  if (!listaTarefas) return;

  const prioridade = filtroPrioridade?.value;
  const materia = filtroMateriaTarefa?.value;
  const status = filtroStatusTarefa?.value;

  let tarefasFiltradas = DB.tarefas ? [...DB.tarefas] : [];
 
  if (prioridade) {
    tarefasFiltradas = tarefasFiltradas.filter(t => t.prioridade === prioridade);
  }

  if (materia) {
    tarefasFiltradas = tarefasFiltradas.filter(t => t.materia_id === materia);
  }

  if (status === 'pendente') {
    tarefasFiltradas = tarefasFiltradas.filter(t => !t.concluida);
  } else if (status === 'concluida') {
    tarefasFiltradas = tarefasFiltradas.filter(t => t.concluida);
  }

  tarefasFiltradas.sort((a, b) => {
    if (a.concluida !== b.concluida) {
      return a.concluida ? 1 : -1;
    }
    const prioridades = { alta: 0, media: 1, baixa: 2 };
    return (prioridades[a.prioridade] || 1) - (prioridades[b.prioridade] || 1);
  });

  if (tarefasFiltradas.length === 0) {
    listaTarefas.innerHTML = '<div class="text-center text-gray-400 py-12">Nenhuma tarefa encontrada</div>';
    return;
  }

  listaTarefas.innerHTML = tarefasFiltradas.map(t => `
    <div class="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between hover:shadow-md mb-3">
      <div class="flex items-center gap-4 flex-1">
        <input type="checkbox" class="w-5 h-5 rounded text-primary" 
               ${t.concluida ? 'checked' : ''} onchange="toggleTarefa('${t.id}')">
        <div class="flex items-center gap-2 flex-1">
          <span class="priority-dot ${t.prioridade === 'alta' ? 'bg-red-500' : t.prioridade === 'media' ? 'bg-yellow-500' : 'bg-green-500'}"></span>
          <div>
            <p class="text-sm font-medium ${t.concluida ? 'line-through text-gray-400' : 'text-gray-700'}">${t.titulo}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-gray-500">📚 ${getMateriaNome(t.materia_id)}</span>
              ${t.prazo ? `<span class="text-xs text-gray-500">📅 ${formatarDataCurta(t.prazo)}</span>` : ''}
              ${t.notificar ? `<span class="text-xs text-indigo-600">🔔 Lembrete ${t.notificar_minutos}min antes</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs font-bold px-3 py-1 rounded-full 
                   ${t.prioridade === 'alta' ? 'bg-red-100 text-red-600' : 
                     t.prioridade === 'media' ? 'bg-yellow-100 text-yellow-600' : 
                     'bg-green-100 text-green-600'}">
          ${t.prioridade.charAt(0).toUpperCase() + t.prioridade.slice(1)}
        </span>
        <button class="text-red-500 hover:text-red-700" onclick="excluirTarefa('${t.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

function popularSelectMaterias(selectId) {
  const select = $(`#${selectId}`);
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = '<option value="">Todas</option>' +
    (DB.materias ? DB.materias.map(m => `<option value="${m.id}">${m.nome}</option>`).join('') : '');
  select.value = valorAtual;
}

function renderNotas() {
  const buscaNotas = $('#busca-notas');
  const btnBuscaNotas = $('#btn-busca-notas');
  const listaNotas = $('#lista-notas');

  if (!listaNotas) return;

  if (!DB.notas || DB.notas.length === 0) {
    listaNotas.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-12">Nenhuma nota cadastrada</div>';
    return;
  }

  listaNotas.innerHTML = DB.notas.map(n => `
    <div class="p-6 rounded-xl h-48 relative cursor-pointer hover:shadow-lg transition-shadow group"
         style="background:${n.cor || '#4f46e5'}20; border: 1px solid ${n.cor || '#4f46e5'}40"
         onclick="editarNota('${n.id}')">
      <h4 class="font-bold mb-2 truncate">${n.titulo || 'Sem título'}</h4>
      <p class="text-sm text-gray-600 line-clamp-4">${n.conteudo || 'Sem conteúdo'}</p>
      <button class="absolute bottom-4 right-4 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
              onclick="excluirNota('${n.id}'); event.stopPropagation();" title="Excluir nota">
        🗑️
      </button>
    </div>
  `).join('');
}

function renderMaterias() {
  const listaMaterias = $('#lista-materias');
  
  if (!listaMaterias) return;

  if (!DB.materias || DB.materias.length === 0) {
    listaMaterias.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-12">Nenhuma matéria cadastrada</div>';
    return;
  }

  listaMaterias.innerHTML = DB.materias.map(m => {
    const status = getStatusFaltas(m.id);
    const porcentagem = calcularPorcentagemFaltas(m.id);
    
    const eventosCount = DB.eventos?.filter(e => e.materia_id === m.id).length || 0;
    const tarefasCount = DB.tarefas?.filter(t => t.materia_id === m.id && !t.concluida).length || 0;
    const aulasCount = DB.horarios?.filter(h => h.materia_id === m.id).length || 0;
    
    return `
      <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                 style="background:${m.cor || '#4f46e5'}">
              ${m.nome ? m.nome.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h4 class="font-bold text-gray-800">${m.nome || 'Sem nome'}</h4>
              <p class="text-xs text-gray-500">${m.professor || 'Sem professor'}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50" 
                    onclick="editarMateria('${m.id}')">
              ✏️
            </button>
            <button class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" 
                    onclick="excluirMateria('${m.id}')">
              🗑️
            </button>
          </div>
        </div>
        
        <div class="space-y-2 text-sm">
          <p class="text-gray-600 flex items-center gap-2">
            <span class="text-gray-400">📍</span>
            <span>${m.sala || 'Sala não definida'}</span>
          </p>
          
          <div class="flex gap-4 text-xs">
            <span class="flex items-center gap-1">
              <span class="text-indigo-500">📅</span>
              <span>${eventosCount} evento(s)</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="text-yellow-500">✅</span>
              <span>${tarefasCount} tarefa(s)</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="text-green-500">🕐</span>
              <span>${aulasCount} aula(s)</span>
            </span>
          </div>
        </div>
        
        ${m.max_faltas ? `
          <div class="mt-4 pt-4 border-t border-gray-100">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-500">Faltas</span>
              <span class="${status.class}">${m.faltas || 0}/${m.max_faltas} (${status.text})</span>
            </div>
            <div class="faltas-bar">
              <div class="faltas-progress" style="width: ${porcentagem}%; background: ${m.cor || '#4f46e5'}"></div>
            </div>
            <div class="flex gap-2 mt-3">
              <button class="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg" 
                      onclick="adicionarFalta('${m.id}'); event.stopPropagation();">
                + Adicionar falta
              </button>
              <button class="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg" 
                      onclick="removerFalta('${m.id}'); event.stopPropagation();" ${(m.faltas || 0) === 0 ? 'disabled' : ''}>
                - Remover falta
              </button>
            </div>
          </div>
        ` : `
          <div class="mt-4 pt-4 border-t border-gray-100">
            <button class="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg"
                    onclick="editarMateria('${m.id}'); event.stopPropagation();">
              ⚙️ Configurar limite de faltas
            </button>
          </div>
        `}
      </div>
    `;
  }).join('');
}

function renderHorarios() {
  const gradeHorarios = $('#grade-horarios');
  
  if (!gradeHorarios) return;

  if (!DB.horarios || DB.horarios.length === 0) {
    gradeHorarios.innerHTML = '<div class="p-12 text-center text-gray-400">Nenhum horário cadastrado</div>';
    return;
  }

  const dias = [
    { id: 1, nome: 'SEG' },
    { id: 2, nome: 'TER' },
    { id: 3, nome: 'QUA' },
    { id: 4, nome: 'QUI' },
    { id: 5, nome: 'SEX' },
    { id: 6, nome: 'SÁB' }
  ];
  
  const horarios = [];
  for (let h = 7; h <= 22; h++) {
    horarios.push(`${h.toString().padStart(2, '0')}:00`);
  }

  let html = `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse bg-white rounded-xl shadow-sm">
        <thead>
          <tr class="bg-gray-50">
            <th class="p-3 text-xs font-bold text-gray-500 border border-gray-200 w-20">HORÁRIO</th>
            ${dias.map(dia => `
              <th class="p-3 text-xs font-bold text-gray-500 border border-gray-200">${dia.nome}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  for (let i = 0; i < horarios.length; i++) {
    const hora = horarios[i];
    let linha = `<tr class="hover:bg-gray-50/50">`;
    linha += `<td class="p-2 text-xs font-medium text-gray-400 border border-gray-100 text-center">${hora}</td>`;
    
    dias.forEach(dia => {
      const aula = DB.horarios.find(h => 
        h.dia_semana === dia.id && 
        h.hora_inicio === hora
      );

      if (aula) {
        const horaInicio = parseInt(aula.hora_inicio.split(':')[0]);
        const horaFim = parseInt(aula.hora_fim.split(':')[0]);
        const rowspan = horaFim - horaInicio;
        
        linha += `
          <td class="border border-gray-100 p-1 relative" rowspan="${rowspan}">
            <div class="bg-primary text-white p-2 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity relative group"
                 style="background: ${getMateriaCor(aula.materia_id)}; min-height: ${rowspan * 40}px"
                 onclick="editarHorario('${aula.id}')">
              <div>${getMateriaNome(aula.materia_id)}</div>
              <div class="text-[10px] opacity-90">${aula.hora_inicio} - ${aula.hora_fim}</div>
              <button class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                      onclick="excluirHorario('${aula.id}'); event.stopPropagation();" title="Excluir">
                ✕
              </button>
            </div>
          </td>
        `;
      } else {
        linha += `<td class="border border-gray-100"></td>`;
      }
    });
    
    linha += `</tr>`;
    html += linha;
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  gradeHorarios.innerHTML = html;
}

// =============================================
// FUNÇÕES CRUD
// =============================================

async function salvarMateria() {
  const nome = $('#maNome').value.trim();
  if (!nome) {
    toast('Preencha o nome!', 'error');
    return;
  }

  const materia = {
    id: itemEditandoId || uid(),
    nome,
    professor: $('#maProfessor').value.trim(),
    sala: $('#maSala').value.trim(),
    max_faltas: parseInt($('#maMaxFaltas').value) || 0,
    faltas: parseInt($('#maFaltas').value) || 0,
    cor: $('#maCor').value
  };

  if (window.data) {
    await window.data.save('materias', materia);
    DB = window.data.getDB();
  }
  
  fecharModal();
  renderMaterias();
  renderDashboard();
  toast(itemEditandoId ? 'Matéria atualizada!' : 'Matéria criada!');
}

async function excluirMateria(id) {
  if (confirm('Excluir esta matéria?')) {
    if (window.data) {
      await window.data.delete('materias', id);
      DB = window.data.getDB();
    }
    renderMaterias();
    renderDashboard();
    toast('Matéria excluída!', 'error');
  }
}

async function adicionarFalta(materiaId) {
  if (window.data) {
    const materia = await window.data.getById('materias', materiaId);
    if (materia) {
      materia.faltas = (materia.faltas || 0) + 1;
      await window.data.save('materias', materia);
      DB = window.data.getDB();
      renderMaterias();
      toast('Falta adicionada!');
    }
  }
}

async function removerFalta(materiaId) {
  if (window.data) {
    const materia = await window.data.getById('materias', materiaId);
    if (materia && (materia.faltas || 0) > 0) {
      materia.faltas = (materia.faltas || 0) - 1;
      await window.data.save('materias', materia);
      DB = window.data.getDB();
      renderMaterias();
      toast('Falta removida!');
    }
  }
}

async function salvarEvento() {
  const titulo = $('#evTitulo').value.trim();
  const data_evento = $('#evData').value;

  if (!titulo || !data_evento) {
    toast('Preencha título e data!', 'error');
    return;
  }

  const notificar = $('#evNotificar')?.checked || false;
  const notificarMinutos = notificar ? parseInt($('#evNotificarMinutos')?.value || 30) : null;

  const evento = {
    id: itemEditandoId || uid(),
    titulo,
    tipo: $('#evTipo').value,
    materia_id: $('#evMateria').value || null,
    data: data_evento,
    hora: $('#evHora').value || null,
    descricao: $('#evDesc').value.trim(),
    concluido: false,
    notificar,
    notificar_minutos: notificarMinutos
  };

  if (itemEditandoId) cancelarNotificacao(itemEditandoId, 'evento');

  if (window.data) {
    await window.data.save('eventos', evento);
    DB = window.data.getDB();
  }
  
  if (notificar && notificarMinutos) {
    agendarNotificacaoEvento(evento, notificarMinutos);
  }
  
  fecharModal();
  renderAgenda();
  renderDashboard();
  toast(itemEditandoId ? 'Evento atualizado!' : 'Evento criado!');
}

async function excluirEvento(id) {
  if (confirm('Excluir este evento?')) {
    cancelarNotificacao(id, 'evento');
    if (window.data) {
      await window.data.delete('eventos', id);
      DB = window.data.getDB();
    }
    renderAgenda();
    renderDashboard();
    toast('Evento excluído!', 'error');
  }
}

async function salvarTarefa() {
  const titulo = $('#taTitulo').value.trim();
  if (!titulo) {
    toast('Preencha o título!', 'error');
    return;
  }

  const prioridadeRadio = $('input[name="prioridade"]:checked');
  const prioridade = prioridadeRadio ? prioridadeRadio.value : 'media';
  
  const notificar = $('#taNotificar')?.checked || false;
  const notificarMinutos = notificar ? parseInt($('#taNotificarMinutos')?.value || 60) : null;

  const tarefa = {
    id: itemEditandoId || uid(),
    titulo,
    prioridade,
    materia_id: $('#taMateria').value || null,
    prazo: $('#taPrazo').value || null,
    concluida: false,
    notificar,
    notificar_minutos: notificarMinutos
  };

  if (itemEditandoId) cancelarNotificacao(itemEditandoId, 'tarefa');

  if (window.data) {
    await window.data.save('tarefas', tarefa);
    DB = window.data.getDB();
  }
  
  if (notificar && notificarMinutos && tarefa.prazo) {
    agendarNotificacaoTarefa(tarefa, notificarMinutos);
  }
  
  fecharModal();
  renderTarefas();
  renderDashboard();
  toast(itemEditandoId ? 'Tarefa atualizada!' : 'Tarefa criada!');
}

async function excluirTarefa(id) {
  if (confirm('Excluir esta tarefa?')) {
    cancelarNotificacao(id, 'tarefa');
    if (window.data) {
      await window.data.delete('tarefas', id);
      DB = window.data.getDB();
    }
    renderTarefas();
    renderDashboard();
    toast('Tarefa excluída!', 'error');
  }
}

async function toggleTarefa(id) {
  if (window.data) {
    const tarefa = await window.data.getById('tarefas', id);
    if (tarefa) {
      tarefa.concluida = !tarefa.concluida;
      await window.data.save('tarefas', tarefa);
      DB = window.data.getDB();
      renderTarefas();
      renderDashboard();
    }
  }
}

async function salvarNota() {
  const titulo = $('#notaTitulo').value.trim() || 'Sem título';
  const conteudo = $('#notaConteudo').value.trim();

  const nota = {
    id: itemEditandoId || uid(),
    titulo,
    conteudo,
    materia_id: $('#notaMateria').value || null,
    cor: $('#notaCor').value
  };

  if (window.data) {
    await window.data.save('notas', nota);
    DB = window.data.getDB();
  }
  
  fecharModal();
  renderNotas();
  renderDashboard();
  toast(itemEditandoId ? 'Nota atualizada!' : 'Nota criada!');
}

async function excluirNota(id) {
  if (confirm('Excluir esta nota?')) {
    if (window.data) {
      await window.data.delete('notas', id);
      DB = window.data.getDB();
    }
    renderNotas();
    renderDashboard();
    toast('Nota excluída!', 'error');
  }
}

async function salvarHorario() {
  const materiaId = $('#hoMateria').value;
  const diaSemana = parseInt($('#hoDia').value);
  const horaInicio = $('#hoInicio').value;
  const horaFim = $('#hoFim').value;

  if (!materiaId || !diaSemana || !horaInicio || !horaFim) {
    toast('Preencha todos os campos!', 'error');
    return;
  }

  if (horaInicio >= horaFim) {
    toast('Horário de início deve ser antes do fim!', 'error');
    return;
  }

  const conflito = DB.horarios?.some(h => 
    h.id !== itemEditandoId &&
    h.dia_semana === diaSemana &&
    ((horaInicio >= h.hora_inicio && horaInicio < h.hora_fim) ||
     (horaFim > h.hora_inicio && horaFim <= h.hora_fim))
  );

  if (conflito) {
    toast('Conflito de horário!', 'error');
    return;
  }

  const horario = {
    id: itemEditandoId || uid(),
    materia_id: materiaId,
    dia_semana: diaSemana,
    hora_inicio: horaInicio,
    hora_fim: horaFim
  };

  if (window.data) {
    await window.data.save('horarios', horario);
    DB = window.data.getDB();
  }
  
  fecharModal();
  renderHorarios();
  renderDashboard();
  toast(itemEditandoId ? 'Horário atualizado!' : 'Horário adicionado!');
}

async function excluirHorario(id) {
  if (confirm('Excluir este horário?')) {
    if (window.data) {
      await window.data.delete('horarios', id);
      DB = window.data.getDB();
    }
    renderHorarios();
    renderDashboard();
    toast('Horário excluído!', 'error');
  }
}

// =============================================
// FUNÇÕES DE MODAL
// =============================================

function abrirModal(titulo, conteudo) {
  const modalTitle = $('#modal-create-title');
  const modalForm = $('#modal-form');
  const modalContainer = $('#modal-container');

  if (modalTitle) modalTitle.textContent = titulo;
  if (modalForm) modalForm.innerHTML = conteudo;
  if (modalContainer) {
    modalContainer.classList.remove('hidden');
    modalContainer.classList.add('flex');
  }
}

function fecharModal() {
  const modalContainer = $('#modal-container');
  if (modalContainer) {
    modalContainer.classList.add('hidden');
    modalContainer.classList.remove('flex');
  }
  itemEditandoId = null;
}

function abrirModalMateria(materia = null) {
  itemEditandoId = materia?.id || null;
  
  const conteudo = `
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Nome *</label>
      <input type="text" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
             id="maNome" value="${materia?.nome || ''}" placeholder="Ex: Cálculo I" required>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Professor</label>
        <input type="text" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="maProfessor" value="${materia?.professor || ''}" placeholder="Prof. Silva">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Sala</label>
        <input type="text" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="maSala" value="${materia?.sala || ''}" placeholder="B-204">
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Máximo de Faltas</label>
        <input type="number" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="maMaxFaltas" value="${materia?.max_faltas || ''}" placeholder="Ex: 18" min="0">
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Faltas Atuais</label>
        <input type="number" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="maFaltas" value="${materia?.faltas || 0}" placeholder="0" min="0">
      </div>
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Cor</label>
      <input type="color" class="w-full h-10 rounded-xl border-gray-200" 
             id="maCor" value="${materia?.cor || '#4f46e5'}">
    </div>
    <button type="button" class="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 mt-4" 
            onclick="salvarMateria()">
      ${materia ? 'Atualizar' : 'Salvar'}
    </button>
  `;
  
  abrirModal(materia ? 'Editar Matéria' : 'Nova Matéria', conteudo);
}

function abrirModalEvento(evento = null) {
  itemEditandoId = evento?.id || null;
  
  const materiasOptions = DB.materias ? DB.materias.map(m => 
    `<option value="${m.id}" ${evento?.materia_id === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('') : '';

  const conteudo = `
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Título *</label>
      <input type="text" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
             id="evTitulo" value="${evento?.titulo || ''}" placeholder="Ex: Prova de Cálculo" required>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Tipo</label>
        <select class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" id="evTipo">
          <option value="prova" ${evento?.tipo === 'prova' ? 'selected' : ''}>Prova</option>
          <option value="trabalho" ${evento?.tipo === 'trabalho' ? 'selected' : ''}>Trabalho</option>
          <option value="aula" ${evento?.tipo === 'aula' ? 'selected' : ''}>Aula</option>
          <option value="outro" ${evento?.tipo === 'outro' ? 'selected' : ''}>Outro</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Matéria</label>
        <select class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" id="evMateria">
          <option value="">Sem matéria</option>
          ${materiasOptions}
        </select>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Data *</label>
        <input type="date" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="evData" value="${evento?.data || hoje()}" required>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Hora</label>
        <input type="time" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="evHora" value="${evento?.hora || ''}">
      </div>
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Descrição</label>
      <textarea class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
                id="evDesc" rows="3">${evento?.descricao || ''}</textarea>
    </div>
    
    <div class="border-t border-gray-200 pt-4 mt-4">
      <h4 class="font-semibold text-gray-700 mb-2">⏰ Lembrete</h4>
      <div class="flex items-center gap-3 mb-3">
        <input type="checkbox" id="evNotificar" class="w-5 h-5 rounded text-primary" ${evento?.notificar ? 'checked' : ''}>
        <label for="evNotificar" class="text-sm text-gray-700">Ativar lembrete</label>
      </div>
      <div id="evOpcoesLembrete" class="space-y-3 ${evento?.notificar ? '' : 'hidden'}">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Notificar</label>
          <select class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" id="evNotificarMinutos">
            <option value="5" ${evento?.notificar_minutos === 5 ? 'selected' : ''}>5 minutos antes</option>
            <option value="15" ${evento?.notificar_minutos === 15 ? 'selected' : ''}>15 minutos antes</option>
            <option value="30" ${evento?.notificar_minutos === 30 ? 'selected' : ''}>30 minutos antes</option>
            <option value="60" ${evento?.notificar_minutos === 60 ? 'selected' : ''}>1 hora antes</option>
            <option value="120" ${evento?.notificar_minutos === 120 ? 'selected' : ''}>2 horas antes</option>
            <option value="1440" ${evento?.notificar_minutos === 1440 ? 'selected' : ''}>1 dia antes</option>
          </select>
        </div>
      </div>
    </div>
    
    <button type="button" class="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 mt-4" 
            onclick="salvarEvento()">
      ${evento ? 'Atualizar' : 'Salvar'}
    </button>
  `;
  
  abrirModal(evento ? 'Editar Evento' : 'Novo Evento', conteudo);
  
  setTimeout(() => {
    const evNotificar = $('#evNotificar');
    if (evNotificar) {
      evNotificar.addEventListener('change', function(e) {
        const opcoes = $('#evOpcoesLembrete');
        if (opcoes) {
          opcoes.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
  }, 100);
}

function abrirModalTarefa(tarefa = null) {
  itemEditandoId = tarefa?.id || null;
  
  const materiasOptions = DB.materias ? DB.materias.map(m => 
    `<option value="${m.id}" ${tarefa?.materia_id === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('') : '';

  const conteudo = `
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Título *</label>
      <input type="text" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
             id="taTitulo" value="${tarefa?.titulo || ''}" placeholder="Ex: Estudar para prova" required>
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Prioridade</label>
      <div class="grid grid-cols-3 gap-2">
        <label class="flex items-center gap-2 p-2 border rounded-lg cursor-pointer ${tarefa?.prioridade === 'baixa' ? 'border-green-500 bg-green-50' : 'border-gray-200'}">
          <input type="radio" name="prioridade" value="baixa" class="hidden" ${tarefa?.prioridade === 'baixa' ? 'checked' : ''}>
          <span class="priority-dot bg-green-500"></span>
          <span class="text-sm">Baixa</span>
        </label>
        <label class="flex items-center gap-2 p-2 border rounded-lg cursor-pointer ${tarefa?.prioridade === 'media' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'}">
          <input type="radio" name="prioridade" value="media" class="hidden" ${tarefa?.prioridade === 'media' ? 'checked' : ''}>
          <span class="priority-dot bg-yellow-500"></span>
          <span class="text-sm">Média</span>
        </label>
        <label class="flex items-center gap-2 p-2 border rounded-lg cursor-pointer ${tarefa?.prioridade === 'alta' ? 'border-red-500 bg-red-50' : 'border-gray-200'}">
          <input type="radio" name="prioridade" value="alta" class="hidden" ${tarefa?.prioridade === 'alta' ? 'checked' : ''}>
          <span class="priority-dot bg-red-500"></span>
          <span class="text-sm">Alta</span>
        </label>
      </div>
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Matéria</label>
      <select class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" id="taMateria">
        <option value="">Sem matéria</option>
        ${materiasOptions}
      </select>
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Prazo</label>
      <input type="date" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
             id="taPrazo" value="${tarefa?.prazo || ''}">
    </div>
    
    <div class="border-t border-gray-200 pt-4 mt-4">
      <h4 class="font-semibold text-gray-700 mb-2">⏰ Lembrete</h4>
      <div class="flex items-center gap-3 mb-3">
        <input type="checkbox" id="taNotificar" class="w-5 h-5 rounded text-primary" ${tarefa?.notificar ? 'checked' : ''}>
        <label for="taNotificar" class="text-sm text-gray-700">Ativar lembrete</label>
      </div>
      <div id="taOpcoesLembrete" class="space-y-3 ${tarefa?.notificar ? '' : 'hidden'}">
        <div>
          <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Notificar</label>
          <select class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" id="taNotificarMinutos">
            <option value="60" ${tarefa?.notificar_minutos === 60 ? 'selected' : ''}>1 hora antes</option>
            <option value="120" ${tarefa?.notificar_minutos === 120 ? 'selected' : ''}>2 horas antes</option>
            <option value="240" ${tarefa?.notificar_minutos === 240 ? 'selected' : ''}>4 horas antes</option>
            <option value="1440" ${tarefa?.notificar_minutos === 1440 ? 'selected' : ''}>1 dia antes</option>
            <option value="2880" ${tarefa?.notificar_minutos === 2880 ? 'selected' : ''}>2 dias antes</option>
          </select>
        </div>
      </div>
    </div>
    
    <button type="button" class="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 mt-4" 
            onclick="salvarTarefa()">
      ${tarefa ? 'Atualizar' : 'Salvar'}
    </button>
  `;
  
  abrirModal(tarefa ? 'Editar Tarefa' : 'Nova Tarefa', conteudo);
  
  setTimeout(() => {
    const taNotificar = $('#taNotificar');
    if (taNotificar) {
      taNotificar.addEventListener('change', function(e) {
        const opcoes = $('#taOpcoesLembrete');
        if (opcoes) {
          opcoes.classList.toggle('hidden', !e.target.checked);
        }
      });
    }
  }, 100);
}

function abrirModalHorario(horario = null) {
  itemEditandoId = horario?.id || null;
  
  const materiasOptions = DB.materias ? DB.materias.map(m => 
    `<option value="${m.id}" ${horario?.materia_id === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('') : '';

  const diasOptions = [
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' }
  ].map(d => 
    `<option value="${d.value}" ${horario?.dia_semana === d.value ? 'selected' : ''}>${d.label}</option>`
  ).join('');

  const conteudo = `
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Matéria *</label>
      <select class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" id="hoMateria" required>
        <option value="">Selecione...</option>
        ${materiasOptions}
      </select>
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Dia da Semana *</label>
      <select class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" id="hoDia" required>
        ${diasOptions}
      </select>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Início *</label>
        <input type="time" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="hoInicio" value="${horario?.hora_inicio || '08:00'}" required>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Fim *</label>
        <input type="time" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="hoFim" value="${horario?.hora_fim || '10:00'}" required>
      </div>
    </div>
    <button type="button" class="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 mt-4" 
            onclick="salvarHorario()">
      ${horario ? 'Atualizar' : 'Salvar'}
    </button>
  `;
  
  abrirModal(horario ? 'Editar Horário' : 'Novo Horário', conteudo);
}

function abrirModalNota(nota = null) {
  itemEditandoId = nota?.id || null;
  
  const materiasOptions = DB.materias ? DB.materias.map(m => 
    `<option value="${m.id}" ${nota?.materia_id === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('') : '';

  const conteudo = `
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Título</label>
      <input type="text" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
             id="notaTitulo" value="${nota?.titulo || ''}" placeholder="Título da nota">
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Matéria</label>
      <select class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" id="notaMateria">
        <option value="">Sem matéria</option>
        ${materiasOptions}
      </select>
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Conteúdo</label>
      <textarea class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
                id="notaConteudo" rows="6" placeholder="Escreva sua nota aqui...">${nota?.conteudo || ''}</textarea>
    </div>
    <div>
      <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Cor</label>
      <input type="color" class="w-full h-10 rounded-xl border-gray-200" 
             id="notaCor" value="${nota?.cor || '#4f46e5'}">
    </div>
    <button type="button" class="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 mt-4" 
            onclick="salvarNota()">
      ${nota ? 'Atualizar' : 'Salvar'}
    </button>
  `;
  
  abrirModal(nota ? 'Editar Nota' : 'Nova Nota', conteudo);
}

function abrirModalImportExport() {
  const modal = $('#modal-import-export');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function fecharModalImportExport() {
  const modal = $('#modal-import-export');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function importarArquivo() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const dados = JSON.parse(ev.target.result);
          if (confirm('Isso substituirá todos os dados atuais. Deseja continuar?')) {
            if (window.data) {
              await window.data.importFromJSON(dados);
              DB = window.data.getDB();
            }
            navigateTo(paginaAtual);
            toast('Dados importados com sucesso!');
            fecharModalImportExport();
          }
        } catch (erro) {
          toast('Arquivo inválido!', 'error');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function exportarArquivo() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `uniagenda_${hoje()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Dados exportados com sucesso!');
  fecharModalImportExport();
}

// =============================================
// FUNÇÕES DE NOTIFICAÇÃO
// =============================================

async function solicitarPermissaoNotificacoes() {
  if (!('Notification' in window)) {
    console.log('Este navegador não suporta notificações');
    return false;
  }

  if (Notification.permission === 'granted') {
    notificationPermission = true;
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    notificationPermission = permission === 'granted';
    return notificationPermission;
  }

  return false;
}

function verificarPermissaoNotificacoes() {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

function mostrarNotificacao(titulo, options = {}) {
  if (!verificarPermissaoNotificacoes()) {
    console.log('Sem permissão para notificações');
    return false;
  }

  const defaultOptions = {
    body: '',
    icon: '/icons/maskable_icon_x192.png',
    badge: '/icons/favicon-32x32.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      dateOfArrival: Date.now()
    },
    requireInteraction: false,
    silent: false
  };

  const notificacao = new Notification(titulo, { ...defaultOptions, ...options });
  
  notificacao.onclick = function(event) {
    event.preventDefault();
    window.focus();
    if (options.onClick) options.onClick();
  };

  return true;
}

function agendarNotificacaoEvento(evento, minutosAntes = 30) {
  if (!evento || !evento.data || !evento.titulo) return null;
  if (!verificarPermissaoNotificacoes()) return null;
  
  const dataEvento = new Date(`${evento.data}T${evento.hora || '00:00'}`);
  const dataNotificacao = new Date(dataEvento.getTime() - (minutosAntes * 60 * 1000));
  
  if (dataNotificacao <= new Date()) return null;
  
  const tempoMs = dataNotificacao.getTime() - Date.now();
  
  const timerId = setTimeout(() => {
    const tipoTexto = {
      prova: '📝 Prova',
      trabalho: '📋 Trabalho',
      aula: '🎓 Aula',
      outro: '📌 Evento'
    }[evento.tipo] || '📌 Evento';
    
    mostrarNotificacao(`🔔 ${tipoTexto}: ${evento.titulo}`, {
      body: `Começa em ${minutosAntes} minutos!\n📅 ${formatarDataCurta(evento.data)} ${evento.hora ? `às ${evento.hora}` : ''}`,
      data: {
        url: '/?page=agenda',
        id: evento.id,
        type: 'evento'
      },
      tag: `evento-${evento.id}`,
      requireInteraction: true,
      onClick: () => navigateTo('agenda')
    });
    
    delete notificationTimers[`evento-${evento.id}`];
  }, tempoMs);
  
  notificationTimers[`evento-${evento.id}`] = timerId;
  return timerId;
}

function agendarNotificacaoTarefa(tarefa, minutosAntes = 60) {
  if (!tarefa || !tarefa.prazo || !tarefa.titulo) return null;
  if (!verificarPermissaoNotificacoes()) return null;
  
  const dataPrazo = new Date(`${tarefa.prazo}T23:59:59`);
  const dataNotificacao = new Date(dataPrazo.getTime() - (minutosAntes * 60 * 1000));
  
  if (dataNotificacao <= new Date()) return null;
  
  const tempoMs = dataNotificacao.getTime() - Date.now();
  
  const timerId = setTimeout(() => {
    const prioridadeTexto = {
      alta: '🔴 Alta Prioridade',
      media: '🟡 Média Prioridade',
      baixa: '🟢 Baixa Prioridade'
    }[tarefa.prioridade] || '';
    
    mostrarNotificacao(`✅ Tarefa: ${tarefa.titulo}`, {
      body: `Vence em ${minutosAntes} minutos!\n${prioridadeTexto}\n📚 ${getMateriaNome(tarefa.materia_id)}`,
      data: {
        url: '/?page=tarefas',
        id: tarefa.id,
        type: 'tarefa'
      },
      tag: `tarefa-${tarefa.id}`,
      requireInteraction: true,
      onClick: () => navigateTo('tarefas')
    });
    
    delete notificationTimers[`tarefa-${tarefa.id}`];
  }, tempoMs);
  
  notificationTimers[`tarefa-${tarefa.id}`] = timerId;
  return timerId;
}

function cancelarNotificacao(id, tipo = 'evento') {
  const key = `${tipo}-${id}`;
  if (notificationTimers[key]) {
    clearTimeout(notificationTimers[key]);
    delete notificationTimers[key];
    return true;
  }
  return false;
}

function reagendarTodasNotificacoes() {
  if (!verificarPermissaoNotificacoes()) return;
  
  Object.keys(notificationTimers).forEach(key => {
    clearTimeout(notificationTimers[key]);
  });
  notificationTimers = {};
  
  DB.eventos?.forEach(evento => {
    if (evento.notificar && evento.notificar_minutos && !evento.concluido) {
      agendarNotificacaoEvento(evento, evento.notificar_minutos);
    }
  });
  
  DB.tarefas?.forEach(tarefa => {
    if (tarefa.notificar && tarefa.notificar_minutos && !tarefa.concluida && tarefa.prazo) {
      agendarNotificacaoTarefa(tarefa, tarefa.notificar_minutos);
    }
  });
}

function updateConnectionStatus() {
  const statusDiv = $('#connection-status');
  if (statusDiv) {
    if (!navigator.onLine) {
      statusDiv.classList.remove('hidden');
    } else {
      statusDiv.classList.add('hidden');
    }
  }
}

function handleAddButton() {
  console.log('Botão Adicionar clicado - Página atual:', paginaAtual);
  
  switch(paginaAtual) {
    case 'materias':
      abrirModalMateria();
      break;
    case 'agenda':
      abrirModalEvento();
      break;
    case 'tarefas':
      abrirModalTarefa();
      break;
    case 'horarios':
      abrirModalHorario();
      break;
    case 'notas':
      abrirModalNota();
      break;
    default:
      if (!DB.materias || DB.materias.length === 0) {
        if (confirm('Comece cadastrando uma matéria!')) {
          abrirModalMateria();
        }
      } else {
        abrirModalEvento();
      }
  }
}

function setupEventListeners() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.nav);
    });
  });

  $$('[data-mobile-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.mobileNav);
    });
  });

  $('#btn-add')?.addEventListener('click', handleAddButton);
  $('#modal-close')?.addEventListener('click', fecharModal);
  $('#modal-backdrop')?.addEventListener('click', fecharModal);
  $('#btn-importar')?.addEventListener('click', importarArquivo);
  $('#btn-exportar')?.addEventListener('click', exportarArquivo);

  const mobileDataBtn = $('#mobile-data-btn');
  if (mobileDataBtn) {
    mobileDataBtn.addEventListener('click', abrirModalImportExport);
  }

  $('#modal-ie-close')?.addEventListener('click', fecharModalImportExport);
  $('#modal-ie-backdrop')?.addEventListener('click', fecharModalImportExport);
  $('#mobile-export-btn')?.addEventListener('click', exportarArquivo);
  $('#mobile-import-btn')?.addEventListener('click', importarArquivo);

  $('#filtroPrioridade')?.addEventListener('change', renderTarefas);
  $('#filtroMateriaTarefa')?.addEventListener('change', renderTarefas);
  $('#filtroStatusTarefa')?.addEventListener('change', renderTarefas);
  $('#busca-notas')?.addEventListener('input', renderNotas);
  $('#btn-busca-notas')?.addEventListener('click', renderNotas);
  $('#filtroTipoEvento')?.addEventListener('change', renderAgenda);
  $('#filtroMateriaEvento')?.addEventListener('change', renderAgenda);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fecharModal();
      fecharModalImportExport();
    }
  });

  $('#close-sidebar')?.addEventListener('click', () => {
    const sidebar = $('#sidebar');
    const overlay = $('#sidebar-overlay');
    if (sidebar && overlay) {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    }
  });

  const notificacaoBtn = $('#notificacao-btn');
  if (notificacaoBtn) {
    if (verificarPermissaoNotificacoes()) {
      notificacaoBtn.classList.remove('bg-indigo-500');
      notificacaoBtn.classList.add('bg-green-500');
      notificacaoBtn.title = 'Notificações ativas';
    }
    
    notificacaoBtn.addEventListener('click', async () => {
      const granted = await solicitarPermissaoNotificacoes();
      if (granted) {
        toast('✅ Notificações ativadas!');
        notificacaoBtn.classList.remove('bg-indigo-500');
        notificacaoBtn.classList.add('bg-green-500');
        reagendarTodasNotificacoes();
      } else {
        toast('❌ Permissão negada', 'error');
      }
    });
  }

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => window.auth?.logout());
}

async function init() {
  console.log('🎓 Inicializando UniAgenda...');
  
  const isAuth = await checkAuth();
  if (!isAuth) return;
  
  if (window.auth) {
    await window.auth.init();
  }
  
  if (window.data) {
    await window.data.init();
    DB = window.data.getDB();
  }

  setupEventListeners();
  
  window.addEventListener('online', () => {
    toast('📶 Conexão restabelecida - sincronizando...');
    window.data?.syncWithServer();
    updateConnectionStatus();
  });
  
  window.addEventListener('offline', () => {
    toast('📴 Modo offline', 'error');
    updateConnectionStatus();
  });
  
  updateConnectionStatus();
  
  if (window.auth?.isAuthenticated()) {
    navigateTo('dashboard');
  }
  
  console.log('✅ UniAgenda inicializado!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Exportar funções para o escopo global
window.navigateTo = navigateTo;
window.toggleTarefa = toggleTarefa;
window.excluirEvento = excluirEvento;
window.excluirTarefa = excluirTarefa;
window.excluirHorario = excluirHorario;
window.excluirMateria = excluirMateria;
window.excluirNota = excluirNota;
window.editarEvento = editarEvento;
window.editarTarefa = editarTarefa;
window.editarHorario = editarHorario;
window.editarMateria = editarMateria;
window.editarNota = editarNota;
window.salvarMateria = salvarMateria;
window.salvarEvento = salvarEvento;
window.salvarTarefa = salvarTarefa;
window.salvarHorario = salvarHorario;
window.salvarNota = salvarNota;
window.fecharModal = fecharModal;
window.adicionarFalta = adicionarFalta;
window.removerFalta = removerFalta;
window.abrirModalImportExport = abrirModalImportExport;
window.fecharModalImportExport = fecharModalImportExport;
window.solicitarPermissaoNotificacoes = solicitarPermissaoNotificacoes;
window.mostrarNotificacao = mostrarNotificacao;
window.reagendarTodasNotificacoes = reagendarTodasNotificacoes;