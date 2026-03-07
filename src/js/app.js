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

// Função para gerar UUID v4 válido para o Supabase
const uid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// =============================================
// DEBUG E VERIFICAÇÃO DE FUNÇÕES
// =============================================
window.debugFunctions = {
  check: function() {
    console.group('🔍 Verificação de Funções Globais');
    const funcoes = [
      'editarMateria', 'excluirMateria', 'adicionarFalta', 'removerFalta',
      'editarEvento', 'excluirEvento', 'editarTarefa', 'excluirTarefa',
      'toggleTarefa', 'editarHorario', 'excluirHorario', 'editarNota', 'excluirNota',
      'salvarMateria', 'salvarEvento', 'salvarTarefa', 'salvarHorario', 'salvarNota'
    ];
    
    funcoes.forEach(nome => {
      const status = typeof window[nome] === 'function' ? '✅' : '❌';
      console.log(`${status} ${nome}:`, typeof window[nome]);
    });
    console.groupEnd();
  }
};

// =============================================
// SISTEMA DE TOASTS PROFISSIONAL
// =============================================
const ToastManager = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 350px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  },

  show({ title, message, type = 'success', duration = 5000 }) {
    this.init();
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: toastSlideIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      border-left: 4px solid ${this.getBorderColor(type)};
      pointer-events: auto;
      width: 100%;
    `;

    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-exclamation',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info'
    };

    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    toast.innerHTML = `
      <div style="width: 40px; height: 40px; border-radius: 10px; background: ${colors[type]}; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; flex-shrink: 0;">
        <i class="fa-solid ${icons[type]}"></i>
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 2px;">${title}</div>
        <div style="font-size: 13px; color: #6b7280; line-height: 1.4;">${message}</div>
      </div>
      <div style="color: #9ca3af; cursor: pointer; padding: 4px; border-radius: 6px; transition: all 0.2s; flex-shrink: 0;" 
           onclick="this.parentElement.remove()" onmouseover="this.style.color='#4b5563'; this.style.background='#f3f4f6'" 
           onmouseout="this.style.color='#9ca3af'; this.style.background='transparent'">
        <i class="fa-solid fa-xmark"></i>
      </div>
    `;

    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.animation = 'toastSlideOut 0.2s ease forwards';
          setTimeout(() => toast.remove(), 200);
        }
      }, duration);
    }

    return id;
  },

  getBorderColor(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    return colors[type] || colors.success;
  },

  success(title, message, duration) {
    return this.show({ title, message, type: 'success', duration });
  },

  error(title, message, duration) {
    return this.show({ title, message, type: 'error', duration });
  },

  warning(title, message, duration) {
    return this.show({ title, message, type: 'warning', duration });
  },

  info(title, message, duration) {
    return this.show({ title, message, type: 'info', duration });
  }
};

// Adicionar estilos de animação
const style = document.createElement('style');
style.textContent = `
  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateX(100%) scale(0.8);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }
  
  @keyframes toastSlideOut {
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);

// Substituir função toast antiga pela nova
window.toast = {
  success: (msg) => ToastManager.success('Sucesso', msg),
  error: (msg) => ToastManager.error('Erro', msg),
  warning: (msg) => ToastManager.warning('Atenção', msg),
  info: (msg) => ToastManager.info('Informação', msg)
};

// Manter compatibilidade com código antigo
const toast = (mensagem, tipo = 'success') => {
  if (tipo === 'success') window.toast.success(mensagem);
  else if (tipo === 'error') window.toast.error(mensagem);
  else window.toast.info(mensagem);
};

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
  return m ? m.cor : '#3b82f6';
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

  // Atualizar texto do botão adicionar
  const btnAdd = $('#btn-add span:last-child');
  if (btnAdd) {
    const labels = {
      'dashboard': 'Adicionar',
      'agenda': 'Novo Evento',
      'horarios': 'Novo Horário',
      'tarefas': 'Nova Tarefa',
      'notas': 'Nova Nota',
      'materias': 'Nova Matéria'
    };
    btnAdd.textContent = labels[pagina];
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
      btn.classList.add('active');
      btn.classList.remove('text-gray-400');
    } else {
      btn.classList.remove('active');
      btn.classList.add('text-gray-400');
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
// FUNÇÕES DE RENDERIZAÇÃO ATUALIZADAS
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
      dashEventos.innerHTML = '<li class="text-center text-gray-400 py-8 text-sm">Nenhum evento</li>';
    } else {
      dashEventos.innerHTML = eventos.map(e => `
        <li class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors" onclick="editarEvento('${e.id}')">
          <div class="w-1 h-10 rounded-full" style="background:${getMateriaCor(e.materia_id)}"></div>
          <div class="flex-1">
            <p class="font-medium text-sm text-gray-800">${e.titulo}</p>
            <p class="text-xs text-gray-500">${formatarDataCurta(e.data)}</p>
          </div>
          <button class="action-btn edit" onclick="editarEvento('${e.id}'); event.stopPropagation();" title="Editar">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
        </li>
      `).join('');
    }
  }

  if (dashTarefas && dashTarefasCount) {
    const tarefas = DB.tarefas?.filter(t => !t.concluida).slice(0, 3) || [];
    dashTarefasCount.textContent = tarefas.length;
    
    if (tarefas.length === 0) {
      dashTarefas.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">Nenhuma tarefa</div>';
    } else {
      dashTarefas.innerHTML = tarefas.map(t => `
        <div class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
          <input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                 onchange="toggleTarefa('${t.id}')" ${t.concluida ? 'checked' : ''}>
          <span class="flex-1 text-sm text-gray-700">${t.titulo}</span>
          <span class="priority-dot ${t.prioridade === 'alta' ? 'bg-red-500' : t.prioridade === 'media' ? 'bg-yellow-500' : 'bg-green-500'}"></span>
          <span class="text-xs font-medium px-2 py-1 rounded-full 
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
      dashAulas.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">Nenhuma aula hoje</div>';
    } else {
      dashAulas.innerHTML = aulas.map(a => `
        <div class="p-3 bg-gray-50 rounded-lg flex justify-between items-center border-l-4 cursor-pointer hover:shadow-sm transition-shadow" 
             style="border-left-color: ${getMateriaCor(a.materia_id)}"
             onclick="editarHorario('${a.id}')">
          <div>
            <p class="text-sm font-medium text-gray-800">${getMateriaNome(a.materia_id)}</p>
            <p class="text-xs text-gray-500">${a.hora_inicio} - ${a.hora_fim}</p>
          </div>
          <button class="action-btn edit" onclick="editarHorario('${a.id}'); event.stopPropagation();" title="Editar">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
        </div>
      `).join('');
    }
  }

  if (dashNotas) {
    const notas = DB.notas?.slice(0, 2) || [];
    if (notas.length === 0) {
      dashNotas.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-8 text-sm">Nenhuma nota</div>';
    } else {
      dashNotas.innerHTML = notas.map(n => `
        <div class="p-3 rounded-lg cursor-pointer hover:shadow-md transition-all relative group" 
             style="background:${n.cor || '#3b82f6'}10; border: 1px solid ${n.cor || '#3b82f6'}20"
             onclick="editarNota('${n.id}')">
          <p class="text-xs font-medium text-gray-800 truncate">${n.titulo || 'Sem título'}</p>
          <button class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity action-btn delete"
                  onclick="excluirNota('${n.id}'); event.stopPropagation();" title="Excluir">
            <i class="fa-regular fa-trash-can"></i>
          </button>
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
      listaEventos.innerHTML = '<div class="text-center text-gray-400 py-12 text-sm">Nenhum evento cadastrado</div>';
      return;
    }

    listaEventos.innerHTML = DB.eventos.map(e => `
      <div class="item-card">
        <div class="flex items-center gap-3 flex-1" onclick="editarEvento('${e.id}')">
          <div class="hidden sm:flex flex-col items-center min-w-[50px]">
            <span class="text-sm font-bold text-blue-600">${e.data.split('-')[2]}</span>
            <span class="text-xs text-gray-400">${MESES[parseInt(e.data.split('-')[1])-1]}</span>
          </div>
          <div class="flex-1">
            <h4 class="font-medium text-gray-800">${e.titulo}</h4>
            <p class="text-xs text-gray-500">${getMateriaNome(e.materia_id)} · ${e.hora || '--:--'}</p>
            ${e.descricao ? `<p class="text-xs text-gray-400 mt-1">${e.descricao}</p>` : ''}
            ${e.notificar ? `<span class="inline-block mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              <i class="fa-regular fa-bell mr-1"></i>${e.notificar_minutos}min
            </span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button class="action-btn edit" onclick="editarEvento('${e.id}')" title="Editar">
            <i class="fa-regular fa-pen-to-square"></i>
          </button>
          <button class="action-btn delete" onclick="excluirEvento('${e.id}')" title="Excluir">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
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
    listaTarefas.innerHTML = '<div class="text-center text-gray-400 py-12 text-sm">Nenhuma tarefa encontrada</div>';
    return;
  }

  listaTarefas.innerHTML = tarefasFiltradas.map(t => `
    <div class="item-card">
      <div class="flex items-center gap-3 flex-1">
        <input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
               ${t.concluida ? 'checked' : ''} onchange="toggleTarefa('${t.id}')">
        <div class="flex-1">
          <p class="text-sm font-medium ${t.concluida ? 'line-through text-gray-400' : 'text-gray-800'}">${t.titulo}</p>
          <div class="flex items-center gap-3 mt-1">
            <span class="text-xs text-gray-500">
              <i class="fa-regular fa-book-open mr-1"></i>${getMateriaNome(t.materia_id)}
            </span>
            ${t.prazo ? `<span class="text-xs text-gray-500">
              <i class="fa-regular fa-calendar mr-1"></i>${formatarDataCurta(t.prazo)}
            </span>` : ''}
            ${t.notificar ? `<span class="text-xs text-blue-600">
              <i class="fa-regular fa-bell mr-1"></i>${t.notificar_minutos}min
            </span>` : ''}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="priority-badge priority-${t.prioridade}">
          ${t.prioridade}
        </span>
        <button class="action-btn edit" onclick="editarTarefa('${t.id}')" title="Editar">
          <i class="fa-regular fa-pen-to-square"></i>
        </button>
        <button class="action-btn delete" onclick="excluirTarefa('${t.id}')" title="Excluir">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function popularSelectMaterias(selectId) {
  const select = $(`#${selectId}`);
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = '<option value="">Todas matérias</option>' +
    (DB.materias ? DB.materias.map(m => `<option value="${m.id}">${m.nome}</option>`).join('') : '');
  select.value = valorAtual;
}

function renderNotas() {
  const buscaNotas = $('#busca-notas');
  const btnBuscaNotas = $('#btn-busca-notas');
  const listaNotas = $('#lista-notas');

  if (!listaNotas) return;

  if (!DB.notas || DB.notas.length === 0) {
    listaNotas.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-12 text-sm">Nenhuma nota cadastrada</div>';
    return;
  }

  listaNotas.innerHTML = DB.notas.map(n => `
    <div class="relative p-5 rounded-xl cursor-pointer hover:shadow-lg transition-all group"
         style="background:${n.cor || '#3b82f6'}10; border: 1px solid ${n.cor || '#3b82f6'}20"
         onclick="editarNota('${n.id}')">
      <h4 class="font-medium text-gray-800 mb-2 truncate pr-8">${n.titulo || 'Sem título'}</h4>
      <p class="text-sm text-gray-600 line-clamp-4">${n.conteudo || 'Sem conteúdo'}</p>
      <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button class="action-btn edit" onclick="editarNota('${n.id}'); event.stopPropagation();" title="Editar">
          <i class="fa-regular fa-pen-to-square"></i>
        </button>
        <button class="action-btn delete" onclick="excluirNota('${n.id}'); event.stopPropagation();" title="Excluir">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function renderMaterias() {
  const listaMaterias = $('#lista-materias');
  
  if (!listaMaterias) return;

  if (!DB.materias || DB.materias.length === 0) {
    listaMaterias.innerHTML = '<div class="col-span-3 text-center text-gray-400 py-12 text-sm">Nenhuma matéria cadastrada</div>';
    return;
  }

  listaMaterias.innerHTML = DB.materias.map(m => {
    const status = getStatusFaltas(m.id);
    const porcentagem = calcularPorcentagemFaltas(m.id);
    
    const eventosCount = DB.eventos?.filter(e => e.materia_id === m.id).length || 0;
    const tarefasCount = DB.tarefas?.filter(t => t.materia_id === m.id && !t.concluida).length || 0;
    const aulasCount = DB.horarios?.filter(h => h.materia_id === m.id).length || 0;
    
    return `
      <div class="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white text-base font-bold"
                 style="background:${m.cor || '#3b82f6'}">
              ${m.nome ? m.nome.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h4 class="font-medium text-gray-800">${m.nome || 'Sem nome'}</h4>
              <p class="text-xs text-gray-500">${m.professor || 'Sem professor'}</p>
            </div>
          </div>
          <div class="flex gap-1">
            <button class="action-btn edit" onclick="editarMateria('${m.id}')" title="Editar">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button class="action-btn delete" onclick="excluirMateria('${m.id}')" title="Excluir">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        
        <div class="space-y-2 text-sm">
          <p class="text-gray-600 flex items-center gap-2 text-xs">
            <i class="fa-regular fa-building text-gray-400"></i>
            <span>${m.sala || 'Sala não definida'}</span>
          </p>
          
          <div class="flex gap-3 text-xs">
            <span class="flex items-center gap-1 text-gray-500">
              <i class="fa-regular fa-calendar text-blue-500"></i>
              <span>${eventosCount} evento(s)</span>
            </span>
            <span class="flex items-center gap-1 text-gray-500">
              <i class="fa-regular fa-square-check text-yellow-500"></i>
              <span>${tarefasCount} tarefa(s)</span>
            </span>
            <span class="flex items-center gap-1 text-gray-500">
              <i class="fa-regular fa-clock text-green-500"></i>
              <span>${aulasCount} aula(s)</span>
            </span>
          </div>
        </div>
        
        ${m.max_faltas ? `
          <div class="mt-4 pt-3 border-t border-gray-100">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-500">Faltas</span>
              <span class="${status.class}">${m.faltas || 0}/${m.max_faltas}</span>
            </div>
            <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width: ${porcentagem}%; background: ${m.cor || '#3b82f6'}"></div>
            </div>
            <div class="flex gap-2 mt-3">
              <button class="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1.5 rounded-lg transition-colors" 
                      onclick="adicionarFalta('${m.id}'); event.stopPropagation();">
                <i class="fa-solid fa-plus mr-1"></i>Falta
              </button>
              <button class="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1.5 rounded-lg transition-colors" 
                      onclick="removerFalta('${m.id}'); event.stopPropagation();" ${(m.faltas || 0) === 0 ? 'disabled' : ''}>
                <i class="fa-solid fa-minus mr-1"></i>Falta
              </button>
            </div>
          </div>
        ` : `
          <div class="mt-4 pt-3 border-t border-gray-100">
            <button class="w-full text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
                    onclick="editarMateria('${m.id}'); event.stopPropagation();">
              <i class="fa-solid fa-gear mr-1"></i>Configurar faltas
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
    gradeHorarios.innerHTML = '<div class="p-12 text-center text-gray-400 text-sm">Nenhum horário cadastrado</div>';
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
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-gray-50">
            <th class="p-3 text-xs font-medium text-gray-500 border-b border-gray-200 w-20">HORÁRIO</th>
            ${dias.map(dia => `
              <th class="p-3 text-xs font-medium text-gray-500 border-b border-gray-200">${dia.nome}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  for (let i = 0; i < horarios.length; i++) {
    const hora = horarios[i];
    let linha = `<tr class="hover:bg-gray-50/50">`;
    linha += `<td class="p-2 text-xs text-gray-400 border-b border-gray-100 text-center">${hora}</td>`;
    
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
          <td class="border-b border-gray-100 p-1 relative" rowspan="${rowspan}">
            <div class="bg-blue-50 text-blue-700 p-2 rounded-lg text-xs font-medium cursor-pointer hover:bg-blue-100 transition-colors relative group"
                 style="border-left: 3px solid ${getMateriaCor(aula.materia_id)}"
                 onclick="editarHorario('${aula.id}')">
              <div>${getMateriaNome(aula.materia_id)}</div>
              <div class="text-[10px] opacity-75 mt-1">${aula.hora_inicio} - ${aula.hora_fim}</div>
              <button class="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow-sm"
                      onclick="excluirHorario('${aula.id}'); event.stopPropagation();" title="Excluir">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
          </td>
        `;
      } else {
        linha += `<td class="border-b border-gray-100"></td>`;
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
// FUNÇÕES CRUD - MATÉRIAS
// =============================================

function editarMateria(id) {
  console.log('📝 Editando matéria:', id);
  const materia = DB.materias?.find(m => m.id === id);
  if (materia) {
    itemEditandoId = id;
    abrirModalMateria(materia);
  } else {
    ToastManager.error('Erro', 'Matéria não encontrada');
  }
}

async function salvarMateria() {
  const nome = $('#maNome').value.trim();
  if (!nome) {
    ToastManager.warning('Atenção', 'Preencha o nome da matéria!');
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
  
  if (itemEditandoId) {
    ToastManager.success('Sucesso', 'Matéria atualizada!');
  } else {
    ToastManager.success('Sucesso', 'Matéria criada!');
  }
}

async function excluirMateria(id) {
  if (confirm('Excluir esta matéria?')) {
    if (window.data) {
      await window.data.delete('materias', id);
      DB = window.data.getDB();
    }
    renderMaterias();
    renderDashboard();
    ToastManager.error('Excluído', 'Matéria removida com sucesso');
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
      ToastManager.success('Falta adicionada', `Total: ${materia.faltas}/${materia.max_faltas}`);
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
      ToastManager.success('Falta removida', `Total: ${materia.faltas}/${materia.max_faltas}`);
    }
  }
}

// =============================================
// FUNÇÕES CRUD - EVENTOS
// =============================================

function editarEvento(id) {
  console.log('📝 Editando evento:', id);
  const evento = DB.eventos?.find(e => e.id === id);
  if (evento) {
    itemEditandoId = id;
    abrirModalEvento(evento);
  } else {
    ToastManager.error('Erro', 'Evento não encontrado');
  }
}

async function salvarEvento() {
  const titulo = $('#evTitulo').value.trim();
  const data_evento = $('#evData').value;

  if (!titulo || !data_evento) {
    ToastManager.warning('Atenção', 'Preencha título e data!');
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
  
  if (itemEditandoId) {
    ToastManager.success('Sucesso', 'Evento atualizado!');
  } else {
    ToastManager.success('Sucesso', 'Evento criado!');
  }
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
    ToastManager.error('Excluído', 'Evento removido com sucesso');
  }
}

// =============================================
// FUNÇÕES CRUD - TAREFAS
// =============================================

function editarTarefa(id) {
  console.log('📝 Editando tarefa:', id);
  const tarefa = DB.tarefas?.find(t => t.id === id);
  if (tarefa) {
    itemEditandoId = id;
    abrirModalTarefa(tarefa);
  } else {
    ToastManager.error('Erro', 'Tarefa não encontrada');
  }
}

async function salvarTarefa() {
  const titulo = $('#taTitulo').value.trim();
  if (!titulo) {
    ToastManager.warning('Atenção', 'Preencha o título da tarefa!');
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
  
  if (itemEditandoId) {
    ToastManager.success('Sucesso', 'Tarefa atualizada!');
  } else {
    ToastManager.success('Sucesso', 'Tarefa criada!');
  }
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
    ToastManager.error('Excluído', 'Tarefa removida com sucesso');
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
      
      if (tarefa.concluida) {
        ToastManager.success('Tarefa concluída', 'Parabéns! 🎉');
      }
    }
  }
}

// =============================================
// FUNÇÕES CRUD - NOTAS
// =============================================

function editarNota(id) {
  console.log('📝 Editando nota:', id);
  const nota = DB.notas?.find(n => n.id === id);
  if (nota) {
    itemEditandoId = id;
    abrirModalNota(nota);
  } else {
    ToastManager.error('Erro', 'Nota não encontrada');
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
  
  if (itemEditandoId) {
    ToastManager.success('Sucesso', 'Nota atualizada!');
  } else {
    ToastManager.success('Sucesso', 'Nota criada!');
  }
}

async function excluirNota(id) {
  if (confirm('Excluir esta nota?')) {
    if (window.data) {
      await window.data.delete('notas', id);
      DB = window.data.getDB();
    }
    renderNotas();
    renderDashboard();
    ToastManager.error('Excluído', 'Nota removida com sucesso');
  }
}

// =============================================
// FUNÇÕES CRUD - HORÁRIOS
// =============================================

function editarHorario(id) {
  console.log('📝 Editando horário:', id);
  const horario = DB.horarios?.find(h => h.id === id);
  if (horario) {
    itemEditandoId = id;
    abrirModalHorario(horario);
  } else {
    ToastManager.error('Erro', 'Horário não encontrado');
  }
}

async function salvarHorario() {
  const materiaId = $('#hoMateria').value;
  const diaSemana = parseInt($('#hoDia').value);
  const horaInicio = $('#hoInicio').value;
  const horaFim = $('#hoFim').value;

  if (!materiaId || !diaSemana || !horaInicio || !horaFim) {
    ToastManager.warning('Atenção', 'Preencha todos os campos!');
    return;
  }

  if (horaInicio >= horaFim) {
    ToastManager.warning('Horário inválido', 'Início deve ser antes do fim!');
    return;
  }

  const conflito = DB.horarios?.some(h => 
    h.id !== itemEditandoId &&
    h.dia_semana === diaSemana &&
    ((horaInicio >= h.hora_inicio && horaInicio < h.hora_fim) ||
     (horaFim > h.hora_inicio && horaFim <= h.hora_fim))
  );

  if (conflito) {
    ToastManager.warning('Conflito de horário', 'Já existe uma aula neste período!');
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
  
  if (itemEditandoId) {
    ToastManager.success('Sucesso', 'Horário atualizado!');
  } else {
    ToastManager.success('Sucesso', 'Horário adicionado!');
  }
}

async function excluirHorario(id) {
  if (confirm('Excluir este horário?')) {
    if (window.data) {
      await window.data.delete('horarios', id);
      DB = window.data.getDB();
    }
    renderHorarios();
    renderDashboard();
    ToastManager.error('Excluído', 'Horário removido com sucesso');
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
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Nome *</label>
      <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
             id="maNome" value="${materia?.nome || ''}" placeholder="Ex: Cálculo I" required>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Professor</label>
        <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
               id="maProfessor" value="${materia?.professor || ''}" placeholder="Prof. Silva">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Sala</label>
        <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
               id="maSala" value="${materia?.sala || ''}" placeholder="B-204">
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Máximo de Faltas</label>
        <input type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
               id="maMaxFaltas" value="${materia?.max_faltas || ''}" placeholder="Ex: 18" min="0">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Faltas Atuais</label>
        <input type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
               id="maFaltas" value="${materia?.faltas || 0}" placeholder="0" min="0">
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Cor</label>
      <input type="color" class="w-full h-10 rounded-lg border border-gray-300" 
             id="maCor" value="${materia?.cor || '#3b82f6'}">
    </div>
    <button type="button" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors mt-4" 
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
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Título *</label>
      <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
             id="evTitulo" value="${evento?.titulo || ''}" placeholder="Ex: Prova de Cálculo" required>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Tipo</label>
        <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" id="evTipo">
          <option value="prova" ${evento?.tipo === 'prova' ? 'selected' : ''}>Prova</option>
          <option value="trabalho" ${evento?.tipo === 'trabalho' ? 'selected' : ''}>Trabalho</option>
          <option value="aula" ${evento?.tipo === 'aula' ? 'selected' : ''}>Aula</option>
          <option value="outro" ${evento?.tipo === 'outro' ? 'selected' : ''}>Outro</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Matéria</label>
        <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" id="evMateria">
          <option value="">Sem matéria</option>
          ${materiasOptions}
        </select>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Data *</label>
        <input type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
               id="evData" value="${evento?.data || hoje()}" required>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Hora</label>
        <input type="time" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
               id="evHora" value="${evento?.hora || ''}">
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Descrição</label>
      <textarea class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                id="evDesc" rows="3">${evento?.descricao || ''}</textarea>
    </div>
    
    <div class="border-t border-gray-200 pt-4 mt-4">
      <h4 class="font-medium text-gray-700 mb-2">⏰ Lembrete</h4>
      <div class="flex items-center gap-3 mb-3">
        <input type="checkbox" id="evNotificar" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" ${evento?.notificar ? 'checked' : ''}>
        <label for="evNotificar" class="text-sm text-gray-700">Ativar lembrete</label>
      </div>
      <div id="evOpcoesLembrete" class="space-y-3 ${evento?.notificar ? '' : 'hidden'}">
        <div>
          <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Notificar</label>
          <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" id="evNotificarMinutos">
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
    
    <button type="button" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors mt-4" 
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
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Título *</label>
      <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
             id="taTitulo" value="${tarefa?.titulo || ''}" placeholder="Ex: Estudar para prova" required>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Prioridade</label>
      <div class="grid grid-cols-3 gap-2">
        <label class="flex items-center justify-center gap-1 p-2 border rounded-lg cursor-pointer ${tarefa?.prioridade === 'baixa' ? 'border-green-500 bg-green-50' : 'border-gray-200'}">
          <input type="radio" name="prioridade" value="baixa" class="hidden" ${tarefa?.prioridade === 'baixa' ? 'checked' : ''}>
          <span class="priority-dot bg-green-500"></span>
          <span class="text-sm">Baixa</span>
        </label>
        <label class="flex items-center justify-center gap-1 p-2 border rounded-lg cursor-pointer ${tarefa?.prioridade === 'media' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'}">
          <input type="radio" name="prioridade" value="media" class="hidden" ${tarefa?.prioridade === 'media' ? 'checked' : ''}>
          <span class="priority-dot bg-yellow-500"></span>
          <span class="text-sm">Média</span>
        </label>
        <label class="flex items-center justify-center gap-1 p-2 border rounded-lg cursor-pointer ${tarefa?.prioridade === 'alta' ? 'border-red-500 bg-red-50' : 'border-gray-200'}">
          <input type="radio" name="prioridade" value="alta" class="hidden" ${tarefa?.prioridade === 'alta' ? 'checked' : ''}>
          <span class="priority-dot bg-red-500"></span>
          <span class="text-sm">Alta</span>
        </label>
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Matéria</label>
      <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" id="taMateria">
        <option value="">Sem matéria</option>
        ${materiasOptions}
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Prazo</label>
      <input type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
             id="taPrazo" value="${tarefa?.prazo || ''}">
    </div>
    
    <div class="border-t border-gray-200 pt-4 mt-4">
      <h4 class="font-medium text-gray-700 mb-2">⏰ Lembrete</h4>
      <div class="flex items-center gap-3 mb-3">
        <input type="checkbox" id="taNotificar" class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" ${tarefa?.notificar ? 'checked' : ''}>
        <label for="taNotificar" class="text-sm text-gray-700">Ativar lembrete</label>
      </div>
      <div id="taOpcoesLembrete" class="space-y-3 ${tarefa?.notificar ? '' : 'hidden'}">
        <div>
          <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Notificar</label>
          <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" id="taNotificarMinutos">
            <option value="60" ${tarefa?.notificar_minutos === 60 ? 'selected' : ''}>1 hora antes</option>
            <option value="120" ${tarefa?.notificar_minutos === 120 ? 'selected' : ''}>2 horas antes</option>
            <option value="240" ${tarefa?.notificar_minutos === 240 ? 'selected' : ''}>4 horas antes</option>
            <option value="1440" ${tarefa?.notificar_minutos === 1440 ? 'selected' : ''}>1 dia antes</option>
            <option value="2880" ${tarefa?.notificar_minutos === 2880 ? 'selected' : ''}>2 dias antes</option>
          </select>
        </div>
      </div>
    </div>
    
    <button type="button" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors mt-4" 
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
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Matéria *</label>
      <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" id="hoMateria" required>
        <option value="">Selecione...</option>
        ${materiasOptions}
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Dia da Semana *</label>
      <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" id="hoDia" required>
        ${diasOptions}
      </select>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Início *</label>
        <input type="time" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
               id="hoInicio" value="${horario?.hora_inicio || '08:00'}" required>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Fim *</label>
        <input type="time" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
               id="hoFim" value="${horario?.hora_fim || '10:00'}" required>
      </div>
    </div>
    <button type="button" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors mt-4" 
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
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Título</label>
      <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
             id="notaTitulo" value="${nota?.titulo || ''}" placeholder="Título da nota">
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Matéria</label>
      <select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" id="notaMateria">
        <option value="">Sem matéria</option>
        ${materiasOptions}
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Conteúdo</label>
      <textarea class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                id="notaConteudo" rows="6" placeholder="Escreva sua nota aqui...">${nota?.conteudo || ''}</textarea>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Cor</label>
      <input type="color" class="w-full h-10 rounded-lg border border-gray-300" 
             id="notaCor" value="${nota?.cor || '#3b82f6'}">
    </div>
    <button type="button" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors mt-4" 
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
            ToastManager.success('Sucesso', 'Dados importados!');
            fecharModalImportExport();
          }
        } catch (erro) {
          ToastManager.error('Erro', 'Arquivo inválido!');
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
  ToastManager.success('Sucesso', 'Dados exportados!');
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

  $('#menu-btn')?.addEventListener('click', () => {
    const sidebar = $('#sidebar');
    const overlay = $('#sidebar-overlay');
    if (sidebar && overlay) {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
    }
  });

  // Botão de sync manual
  $('#sync-now-btn')?.addEventListener('click', async () => {
    ToastManager.info('Sincronizando', 'Aguarde...');
    await window.data?.syncAll();
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
        notificacaoBtn.classList.remove('bg-indigo-500');
        notificacaoBtn.classList.add('bg-green-500');
        reagendarTodasNotificacoes();
        ToastManager.success('Notificações ativadas!', 'Você receberá lembretes dos eventos');
      } else {
        ToastManager.error('Permissão negada', 'Ative manualmente nas configurações');
      }
    });
  }

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => window.auth?.logout());
}

// Função para limpar dados inválidos do localStorage
function limparDadosInvalidos() {
  try {
    const saved = localStorage.getItem('uniagenda_db');
    if (saved) {
      const dados = JSON.parse(saved);
      let modificado = false;
      
      // Regex para UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      
      // Para cada tabela, filtrar apenas UUIDs válidos
      const tabelas = ['materias', 'eventos', 'tarefas', 'notas', 'horarios'];
      tabelas.forEach(tabela => {
        if (dados[tabela] && Array.isArray(dados[tabela])) {
          const originalLength = dados[tabela].length;
          dados[tabela] = dados[tabela].filter(item => uuidRegex.test(item.id));
          if (dados[tabela].length !== originalLength) {
            modificado = true;
            console.log(`🧹 Removidos ${originalLength - dados[tabela].length} itens inválidos de ${tabela}`);
          }
        }
      });
      
      if (modificado) {
        localStorage.setItem('uniagenda_db', JSON.stringify(dados));
        console.log('✅ Dados inválidos removidos do localStorage');
      }
    }
  } catch (e) {
    console.error('Erro ao limpar dados inválidos:', e);
  }
}
async function init() {
  console.log('🎓 Inicializando UniAgenda...');
  limparDadosInvalidos();
  const isAuth = await checkAuth();
  if (!isAuth) return;
  
  // Inicializar APENAS o DataService (que já faz tudo)
  if (window.data) {
    await window.data.init();
    DB = window.data.getDB();
  }

  setupEventListeners();
  
  window.addEventListener('online', () => {
    ToastManager.info('Conexão restabelecida', 'Sincronizando dados...');
    window.data?.syncAll();
    updateConnectionStatus();
  });
  
  window.addEventListener('offline', () => {
    ToastManager.warning('Modo offline', 'As alterações serão sincronizadas quando voltar');
    updateConnectionStatus();
  });
  
  updateConnectionStatus();
  
  if (window.auth?.isAuthenticated()) {
    navigateTo('dashboard');
  }
  
  console.log('✅ UniAgenda inicializado!');
  
  // Verificar funções globais
  setTimeout(() => window.debugFunctions?.check(), 1000);
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

// Garantir que as funções estão disponíveis globalmente
window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Verificação de funções:');
  console.log('   editarMateria:', typeof window.editarMateria);
  console.log('   excluirMateria:', typeof window.excluirMateria);
  console.log('   adicionarFalta:', typeof window.adicionarFalta);
});