'use strict';

let DB = {
  materias: [],
  eventos: [],
  notas: [],
  horarios: [],
  tarefas: []
};

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
  const m = DB.materias.find(m => m.id === id);
  return m ? m.nome : 'Sem matéria';
}

function getMateriaCor(id) {
  const m = DB.materias.find(m => m.id === id);
  return m ? m.cor : '#4f46e5';
}

function getMateriaFaltas(id) {
  const m = DB.materias.find(m => m.id === id);
  return m ? m.faltas || 0 : 0;
}

function getMateriaMaxFaltas(id) {
  const m = DB.materias.find(m => m.id === id);
  return m ? m.maxFaltas || 0 : 0;
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

const LS_KEY = 'uniagenda_db';

function salvarDB() {
  localStorage.setItem(LS_KEY, JSON.stringify(DB));
  console.log('Dados salvos:', DB);
}

function carregarDB() {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try {
      DB = JSON.parse(raw);
      console.log('Dados carregados:', DB);
      return true;
    } catch (e) {
      console.error('Erro ao carregar DB:', e);
    }
  }
  return false;
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

function navigateTo(pagina) {
  console.log('Navegando para:', pagina);
  paginaAtual = pagina;

  // Esconder todas as seções
  $$('.page-section').forEach(section => {
    section.classList.add('hidden');
  });

  // Mostrar a seção atual
  const sectionAtual = $(`#page-${pagina}`);
  if (sectionAtual) {
    sectionAtual.classList.remove('hidden');
  } else {
    console.warn(`Seção #page-${pagina} não encontrada`);
  }

  // Atualizar título da página
  const titulos = {
    'dashboard': 'Início',
    'agenda': 'Agenda',
    'horarios': 'Grade Horária',
    'tarefas': 'Tarefas',
    'notas': 'Notas',
    'materias': 'Matérias'
  };
  
  const pageTitle = $('#page-title');
  if (pageTitle) {
    pageTitle.textContent = titulos[pagina];
  }

  // Atualizar texto do botão adicionar
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

  // Atualizar navegação sidebar
  $$('.nav-item').forEach(item => {
    if (item.dataset.nav === pagina) {
      item.classList.add('active-nav');
    } else {
      item.classList.remove('active-nav');
    }
  });

  // Atualizar navegação mobile
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
  // Verificar se a seção existe antes de renderizar
  if (!document.getElementById(`page-${pagina}`)) {
    console.warn(`Seção page-${pagina} não encontrada no DOM`);
    return;
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

  if (statEventos) statEventos.textContent = DB.eventos.length;
  if (statTarefas) statTarefas.textContent = DB.tarefas.filter(t => !t.concluida).length;
  if (statNotas) statNotas.textContent = DB.notas.length;
  if (statMaterias) statMaterias.textContent = DB.materias.length;

  if (dashEventos) {
    const eventos = DB.eventos.slice(0, 3);
    if (eventos.length === 0) {
      dashEventos.innerHTML = '<li class="text-center text-gray-400 py-4">Nenhum evento</li>';
    } else {
      dashEventos.innerHTML = eventos.map(e => `
        <li class="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg" onclick="editarEvento('${e.id}')">
          <div class="w-2 h-10 rounded-full" style="background:${getMateriaCor(e.materiaId)}"></div>
          <div class="flex-1">
            <p class="font-medium text-sm">${e.titulo}</p>
            <p class="text-xs text-gray-400">${formatarDataCurta(e.data)}</p>
          </div>
        </li>
      `).join('');
    }
  }

  if (dashTarefas && dashTarefasCount) {
    const tarefas = DB.tarefas.filter(t => !t.concluida).slice(0, 3);
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
    const aulas = DB.horarios.filter(h => h.diaSemana === diaHoje).slice(0, 2);
    if (aulas.length === 0) {
      dashAulas.innerHTML = '<div class="text-center text-gray-400 py-4">Nenhuma aula hoje</div>';
    } else {
      dashAulas.innerHTML = aulas.map(a => `
        <div class="p-3 bg-gray-50 rounded-lg flex justify-between items-center border-l-4 cursor-pointer" 
             style="border-left-color: ${getMateriaCor(a.materiaId)}"
             onclick="editarHorario('${a.id}')">
          <div>
            <p class="text-sm font-bold">${getMateriaNome(a.materiaId)}</p>
            <p class="text-xs text-gray-500">${a.horaInicio} - ${a.horaFim}</p>
          </div>
        </div>
      `).join('');
    }
  }

  if (dashNotas) {
    const notas = DB.notas.slice(0, 2);
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
    if (DB.eventos.length === 0) {
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
          <p class="text-sm text-gray-500">${getMateriaNome(e.materiaId)} · ${e.hora || '--:--'}</p>
          ${e.descricao ? `<p class="text-xs text-gray-400">${e.descricao}</p>` : ''}
          ${e.notificar ? `<span class="inline-block mt-1 text-xs text-indigo-600">🔔 Lembrete ${e.notificarMinutos}min antes</span>` : ''}
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

  let tarefasFiltradas = [...DB.tarefas];
 
  if (prioridade) {
    tarefasFiltradas = tarefasFiltradas.filter(t => t.prioridade === prioridade);
  }

  if (materia) {
    tarefasFiltradas = tarefasFiltradas.filter(t => t.materiaId === materia);
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
              <span class="text-xs text-gray-500">📚 ${getMateriaNome(t.materiaId)}</span>
              ${t.prazo ? `<span class="text-xs text-gray-500">📅 ${formatarDataCurta(t.prazo)}</span>` : ''}
              ${t.notificar ? `<span class="text-xs text-indigo-600">🔔 Lembrete ${t.notificarMinutos}min antes</span>` : ''}
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
    DB.materias.map(m => `<option value="${m.id}">${m.nome}</option>`).join('');
  select.value = valorAtual;
}

function renderNotas() {
  const buscaNotas = $('#busca-notas');
  const btnBuscaNotas = $('#btn-busca-notas');
  const listaNotas = $('#lista-notas');

  if (!listaNotas) return;

  if (DB.notas.length === 0) {
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
  
  if (!listaMaterias) {
    console.warn('Elemento #lista-materias não encontrado');
    return;
  }

  if (DB.materias.length === 0) {
    listaMaterias.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-12">Nenhuma matéria cadastrada</div>';
    return;
  }

  listaMaterias.innerHTML = DB.materias.map(m => {
    const status = getStatusFaltas(m.id);
    const porcentagem = calcularPorcentagemFaltas(m.id);
    
    // Contar eventos, tarefas e aulas relacionados
    const eventosCount = DB.eventos.filter(e => e.materiaId === m.id).length;
    const tarefasCount = DB.tarefas.filter(t => t.materiaId === m.id && !t.concluida).length;
    const aulasCount = DB.horarios.filter(h => h.materiaId === m.id).length;
    
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
                    onclick="editarMateria('${m.id}')" title="Editar matéria">
              ✏️
            </button>
            <button class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" 
                    onclick="excluirMateria('${m.id}')" title="Excluir matéria">
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
        
        ${m.maxFaltas ? `
          <div class="mt-4 pt-4 border-t border-gray-100">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-500">Faltas</span>
              <span class="${status.class}">${m.faltas || 0}/${m.maxFaltas} (${status.text})</span>
            </div>
            <div class="faltas-bar">
              <div class="faltas-progress" style="width: ${porcentagem}%; background: ${m.cor || '#4f46e5'}"></div>
            </div>
            <div class="flex gap-2 mt-3">
              <button class="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors" 
                      onclick="adicionarFalta('${m.id}'); event.stopPropagation();">
                + Adicionar falta
              </button>
              <button class="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors" 
                      onclick="removerFalta('${m.id}'); event.stopPropagation();" ${(m.faltas || 0) === 0 ? 'disabled' : ''}>
                - Remover falta
              </button>
            </div>
          </div>
        ` : `
          <div class="mt-4 pt-4 border-t border-gray-100">
            <button class="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
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

  if (DB.horarios.length === 0) {
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
        h.diaSemana === dia.id && 
        h.horaInicio === hora
      );

      if (aula) {
        const horaInicio = parseInt(aula.horaInicio.split(':')[0]);
        const horaFim = parseInt(aula.horaFim.split(':')[0]);
        const rowspan = horaFim - horaInicio;
        
        linha += `
          <td class="border border-gray-100 p-1 relative" rowspan="${rowspan}">
            <div class="bg-primary text-white p-2 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity relative group"
                 style="background: ${getMateriaCor(aula.materiaId)}; min-height: ${rowspan * 40}px"
                 onclick="editarHorario('${aula.id}')">
              <div>${getMateriaNome(aula.materiaId)}</div>
              <div class="text-[10px] opacity-90">${aula.horaInicio} - ${aula.horaFim}</div>
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

function adicionarFalta(materiaId) {
  const materia = DB.materias.find(m => m.id === materiaId);
  if (materia) {
    materia.faltas = (materia.faltas || 0) + 1;
    salvarDB();
    renderMaterias();
    toast('Falta adicionada!');
  }
}

function removerFalta(materiaId) {
  const materia = DB.materias.find(m => m.id === materiaId);
  if (materia && (materia.faltas || 0) > 0) {
    materia.faltas = (materia.faltas || 0) - 1;
    salvarDB();
    renderMaterias();
    toast('Falta removida!');
  }
}

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

// ... (manter todas as funções de abrirModal e salvar dos diferentes tipos)

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
      if (DB.materias.length === 0) {
        if (confirm('Comece cadastrando uma matéria!')) {
          abrirModalMateria();
        }
      } else {
        abrirModalEvento();
      }
  }
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

function importarArquivo() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const dados = JSON.parse(ev.target.result);
          if (confirm('Isso substituirá todos os dados atuais. Deseja continuar?')) {
            DB = dados;
            salvarDB();
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
      body: `Vence em ${minutosAntes} minutos!\n${prioridadeTexto}\n📚 ${getMateriaNome(tarefa.materiaId)}`,
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
  
  DB.eventos.forEach(evento => {
    if (evento.notificar && evento.notificarMinutos && !evento.concluido) {
      agendarNotificacaoEvento(evento, evento.notificarMinutos);
    }
  });
  
  DB.tarefas.forEach(tarefa => {
    if (tarefa.notificar && tarefa.notificarMinutos && !tarefa.concluida && tarefa.prazo) {
      agendarNotificacaoTarefa(tarefa, tarefa.notificarMinutos);
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

function init() {
  console.log('Inicializando UniAgenda...');
  
  carregarDB();

  // Navegação sidebar
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.nav);
    });
  });

  // Navegação mobile
  $$('[data-mobile-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.mobileNav);
    });
  });

  // Botão adicionar
  const btnAdd = $('#btn-add');
  if (btnAdd) {
    btnAdd.addEventListener('click', handleAddButton);
  }

  // Modal close
  $('#modal-close')?.addEventListener('click', fecharModal);
  $('#modal-backdrop')?.addEventListener('click', fecharModal);

  // Importar/Exportar
  $('#btn-importar')?.addEventListener('click', importarArquivo);
  $('#btn-exportar')?.addEventListener('click', exportarArquivo);

  // Mobile data button
  const mobileDataBtn = $('#mobile-data-btn');
  if (mobileDataBtn) {
    mobileDataBtn.addEventListener('click', abrirModalImportExport);
  }

  // Modal import/export
  $('#modal-ie-close')?.addEventListener('click', fecharModalImportExport);
  $('#modal-ie-backdrop')?.addEventListener('click', fecharModalImportExport);
  $('#mobile-export-btn')?.addEventListener('click', exportarArquivo);
  $('#mobile-import-btn')?.addEventListener('click', importarArquivo);

  // Filtros (adicionar listeners apenas se existirem)
  $('#filtroPrioridade')?.addEventListener('change', renderTarefas);
  $('#filtroMateriaTarefa')?.addEventListener('change', renderTarefas);
  $('#filtroStatusTarefa')?.addEventListener('change', renderTarefas);
  $('#busca-notas')?.addEventListener('input', renderNotas);
  $('#btn-busca-notas')?.addEventListener('click', renderNotas);
  $('#filtroTipoEvento')?.addEventListener('change', renderAgenda);
  $('#filtroMateriaEvento')?.addEventListener('change', renderAgenda);

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fecharModal();
      fecharModalImportExport();
    }
  });

  // Connection status
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus();

  // Notificações
  if (verificarPermissaoNotificacoes()) {
    console.log('✅ Notificações permitidas');
    reagendarTodasNotificacoes();
  }

  // Botão de notificação
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

  // Fechar sidebar mobile
  $('#close-sidebar')?.addEventListener('click', () => {
    const sidebar = $('#sidebar');
    const overlay = $('#sidebar-overlay');
    if (sidebar && overlay) {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    }
  });

  // Abrir sidebar mobile (menu button - se existir)
  const menuBtn = $('#menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const sidebar = $('#sidebar');
      const overlay = $('#sidebar-overlay');
      if (sidebar && overlay) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
      }
    });
  }

  // Iniciar no dashboard
  navigateTo('dashboard');
  console.log('UniAgenda inicializado!');
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