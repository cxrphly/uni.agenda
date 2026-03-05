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
  toast.style.cssText = `
    background: ${tipo === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    margin-top: 10px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = mensagem;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

function navigateTo(pagina) {
  console.log('Navegando para:', pagina);
  paginaAtual = pagina;

  $$('.page-section').forEach(section => {
    section.classList.add('hidden');
  });

  $(`#page-${pagina}`)?.classList.remove('hidden');

  const titulos = {
    'dashboard': 'Início',
    'agenda': 'Agenda',
    'horarios': 'Grade Horária',
    'tarefas': 'Tarefas',
    'notas': 'Notas',
    'materias': 'Matérias'
  };
  $('#page-title').textContent = titulos[pagina];

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
      btn.querySelector('span:last-child')?.classList.add('font-bold');
    } else {
      btn.classList.add('text-gray-400');
      btn.classList.remove('text-primary');
      btn.querySelector('span:last-child')?.classList.remove('font-bold');
    }
  });

  renderPagina(pagina);
}

function renderPagina(pagina) {
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
  $('#stat-eventos').textContent = DB.eventos.length;
  $('#stat-tarefas').textContent = DB.tarefas.filter(t => !t.concluida).length;
  $('#stat-notas').textContent = DB.notas.length;
  $('#stat-materias').textContent = DB.materias.length;

  const eventos = DB.eventos.slice(0, 3);
  if (eventos.length === 0) {
    $('#dash-eventos').innerHTML = '<li class="text-center text-gray-400 py-4">Nenhum evento</li>';
  } else {
    $('#dash-eventos').innerHTML = eventos.map(e => `
      <li class="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg" onclick="editarEvento('${e.id}')">
        <div class="w-2 h-10 rounded-full" style="background:${getMateriaCor(e.materiaId)}"></div>
        <div class="flex-1">
          <p class="font-medium text-sm">${e.titulo}</p>
          <p class="text-xs text-gray-400">${formatarDataCurta(e.data)}</p>
        </div>
      </li>
    `).join('');
  }

  const tarefas = DB.tarefas.filter(t => !t.concluida).slice(0, 3);
  $('#dash-tarefas-count').textContent = tarefas.length;
  if (tarefas.length === 0) {
    $('#dash-tarefas').innerHTML = '<div class="text-center text-gray-400 py-4">Nenhuma tarefa</div>';
  } else {
    $('#dash-tarefas').innerHTML = tarefas.map(t => `
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

  const diaHoje = new Date().getDay();
  const aulas = DB.horarios.filter(h => h.diaSemana === diaHoje).slice(0, 2);
  if (aulas.length === 0) {
    $('#dash-aulas').innerHTML = '<div class="text-center text-gray-400 py-4">Nenhuma aula hoje</div>';
  } else {
    $('#dash-aulas').innerHTML = aulas.map(a => `
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

  const notas = DB.notas.slice(0, 2);
  if (notas.length === 0) {
    $('#dash-notas').innerHTML = '<div class="col-span-2 text-center text-gray-400 py-4">Nenhuma nota</div>';
  } else {
    $('#dash-notas').innerHTML = notas.map(n => `
      <div class="p-3 rounded-lg cursor-pointer" style="background:${n.cor || '#4f46e5'}20" onclick="editarNota('${n.id}')">
        <p class="text-xs font-bold truncate">${n.titulo}</p>
      </div>
    `).join('');
  }
}

function renderAgenda() {
  popularSelectMaterias('filtroMateriaEvento');
  
  if (DB.eventos.length === 0) {
    $('#lista-eventos').innerHTML = '<div class="text-center text-gray-400 py-12">Nenhum evento cadastrado</div>';
    return;
  }

  $('#lista-eventos').innerHTML = DB.eventos.map(e => `
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

function renderTarefas() {
  popularSelectMaterias('filtroMateriaTarefa');
  
  const filtroPrioridade = $('#filtroPrioridade')?.value;
  const filtroMateria = $('#filtroMateriaTarefa')?.value;
  const filtroStatus = $('#filtroStatusTarefa')?.value;

  let tarefasFiltradas = [...DB.tarefas];
 
  if (filtroPrioridade) {
    tarefasFiltradas = tarefasFiltradas.filter(t => t.prioridade === filtroPrioridade);
  }

  if (filtroMateria) {
    tarefasFiltradas = tarefasFiltradas.filter(t => t.materiaId === filtroMateria);
  }

  if (filtroStatus === 'pendente') {
    tarefasFiltradas = tarefasFiltradas.filter(t => !t.concluida);
  } else if (filtroStatus === 'concluida') {
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
    $('#lista-tarefas').innerHTML = '<div class="text-center text-gray-400 py-12">Nenhuma tarefa encontrada</div>';
    return;
  }

  $('#lista-tarefas').innerHTML = tarefasFiltradas.map(t => `
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
  if (DB.notas.length === 0) {
    $('#lista-notas').innerHTML = '<div class="col-span-3 text-center text-gray-400 py-12">Nenhuma nota cadastrada</div>';
    return;
  }

  $('#lista-notas').innerHTML = DB.notas.map(n => `
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
  if (DB.materias.length === 0) {
    $('#lista-materias').innerHTML = '<div class="col-span-3 text-center text-gray-400 py-12">Nenhuma matéria cadastrada</div>';
    return;
  }

  $('#lista-materias').innerHTML = DB.materias.map(m => {
    const status = getStatusFaltas(m.id);
    const porcentagem = calcularPorcentagemFaltas(m.id);
    
    return `
      <div class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                 style="background:${m.cor}">
              ${m.nome.charAt(0)}
            </div>
            <div>
              <h4 class="font-bold">${m.nome}</h4>
              <p class="text-xs text-gray-400">${m.professor || 'Sem professor'}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="text-blue-500 hover:text-blue-700" onclick="editarMateria('${m.id}')" title="Editar">✏️</button>
            <button class="text-red-500 hover:text-red-700" onclick="excluirMateria('${m.id}')" title="Excluir">🗑️</button>
          </div>
        </div>
        
        <p class="text-xs text-gray-500 mb-2">Sala: ${m.sala || 'Não definida'}</p>
        
        ${m.maxFaltas ? `
          <div class="mt-4">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-500">Faltas</span>
              <span class="${status.class}">${m.faltas || 0}/${m.maxFaltas} (${status.text})</span>
            </div>
            <div class="faltas-bar">
              <div class="faltas-progress" style="width: ${porcentagem}%; background: ${m.cor}"></div>
            </div>
            <div class="flex gap-2 mt-2">
              <button class="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200" 
                      onclick="adicionarFalta('${m.id}'); event.stopPropagation();">+ Falta</button>
              <button class="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200" 
                      onclick="removerFalta('${m.id}'); event.stopPropagation();">- Falta</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderHorarios() {
  if (DB.horarios.length === 0) {
    $('#grade-horarios').innerHTML = '<div class="p-12 text-center text-gray-400">Nenhum horário cadastrado</div>';
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

  $('#grade-horarios').innerHTML = html;
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
  $('#modal-create-title').textContent = titulo;
  $('#modal-form').innerHTML = conteudo;
  $('#modal-container').classList.remove('hidden');
  $('#modal-container').classList.add('flex');
}

function fecharModal() {
  $('#modal-container').classList.add('hidden');
  $('#modal-container').classList.remove('flex');
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
               id="maMaxFaltas" value="${materia?.maxFaltas || ''}" placeholder="Ex: 18" min="0">
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

function salvarMateria() {
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
    maxFaltas: parseInt($('#maMaxFaltas').value) || 0,
    faltas: parseInt($('#maFaltas').value) || 0,
    cor: $('#maCor').value
  };

  if (itemEditandoId) {
    const idx = DB.materias.findIndex(m => m.id === itemEditandoId);
    if (idx !== -1) DB.materias[idx] = materia;
  } else {
    DB.materias.push(materia);
  }

  salvarDB();
  fecharModal();
  renderMaterias();
  renderDashboard();
  toast(itemEditandoId ? 'Matéria atualizada!' : 'Matéria criada!');
}

function abrirModalEvento(evento = null) {
  itemEditandoId = evento?.id || null;
  
  const materiasOptions = DB.materias.map(m => 
    `<option value="${m.id}" ${evento?.materiaId === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('');

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
    
    <!-- Seção de Notificação -->
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
            <option value="5" ${evento?.notificarMinutos === 5 ? 'selected' : ''}>5 minutos antes</option>
            <option value="15" ${evento?.notificarMinutos === 15 ? 'selected' : ''}>15 minutos antes</option>
            <option value="30" ${evento?.notificarMinutos === 30 ? 'selected' : ''}>30 minutos antes</option>
            <option value="60" ${evento?.notificarMinutos === 60 ? 'selected' : ''}>1 hora antes</option>
            <option value="120" ${evento?.notificarMinutos === 120 ? 'selected' : ''}>2 horas antes</option>
            <option value="1440" ${evento?.notificarMinutos === 1440 ? 'selected' : ''}>1 dia antes</option>
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
  
  // Adicionar evento para mostrar/esconder opções de lembrete
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

function salvarEvento() {
  const titulo = $('#evTitulo').value.trim();
  const data = $('#evData').value;

  if (!titulo || !data) {
    toast('Preencha título e data!', 'error');
    return;
  }

  const notificar = $('#evNotificar')?.checked || false;
  const notificarMinutos = notificar ? parseInt($('#evNotificarMinutos')?.value || 30) : null;

  const evento = {
    id: itemEditandoId || uid(),
    titulo,
    tipo: $('#evTipo').value,
    materiaId: $('#evMateria').value,
    data,
    hora: $('#evHora').value,
    descricao: $('#evDesc').value.trim(),
    concluido: false,
    notificar: notificar,
    notificarMinutos: notificarMinutos
  };

  // Cancelar notificação antiga se estiver editando
  if (itemEditandoId) {
    cancelarNotificacao(itemEditandoId, 'evento');
  }

  if (itemEditandoId) {
    const idx = DB.eventos.findIndex(e => e.id === itemEditandoId);
    if (idx !== -1) DB.eventos[idx] = evento;
  } else {
    DB.eventos.push(evento);
  }

  salvarDB();
  
  // Agendar nova notificação
  if (notificar && notificarMinutos) {
    agendarNotificacaoEvento(evento, notificarMinutos);
  }
  
  fecharModal();
  renderAgenda();
  renderDashboard();
  toast(itemEditandoId ? 'Evento atualizado!' : 'Evento criado!');
}

function abrirModalTarefa(tarefa = null) {
  itemEditandoId = tarefa?.id || null;
  
  const materiasOptions = DB.materias.map(m => 
    `<option value="${m.id}" ${tarefa?.materiaId === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('');

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
    
    <!-- Seção de Notificação -->
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
            <option value="60" ${tarefa?.notificarMinutos === 60 ? 'selected' : ''}>1 hora antes</option>
            <option value="120" ${tarefa?.notificarMinutos === 120 ? 'selected' : ''}>2 horas antes</option>
            <option value="240" ${tarefa?.notificarMinutos === 240 ? 'selected' : ''}>4 horas antes</option>
            <option value="1440" ${tarefa?.notificarMinutos === 1440 ? 'selected' : ''}>1 dia antes</option>
            <option value="2880" ${tarefa?.notificarMinutos === 2880 ? 'selected' : ''}>2 dias antes</option>
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
  
  // Adicionar evento para mostrar/esconder opções de lembrete
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

function salvarTarefa() {
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
    materiaId: $('#taMateria').value,
    prazo: $('#taPrazo').value,
    concluida: false,
    notificar: notificar,
    notificarMinutos: notificarMinutos
  };

  // Cancelar notificação antiga se estiver editando
  if (itemEditandoId) {
    cancelarNotificacao(itemEditandoId, 'tarefa');
  }

  if (itemEditandoId) {
    const idx = DB.tarefas.findIndex(t => t.id === itemEditandoId);
    if (idx !== -1) DB.tarefas[idx] = tarefa;
  } else {
    DB.tarefas.push(tarefa);
  }

  salvarDB();
  
  // Agendar nova notificação
  if (notificar && notificarMinutos && tarefa.prazo) {
    agendarNotificacaoTarefa(tarefa, notificarMinutos);
  }
  
  fecharModal();
  renderTarefas();
  renderDashboard();
  toast(itemEditandoId ? 'Tarefa atualizada!' : 'Tarefa criada!');
}

function abrirModalHorario(horario = null) {
  itemEditandoId = horario?.id || null;
  
  const materiasOptions = DB.materias.map(m => 
    `<option value="${m.id}" ${horario?.materiaId === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('');

  const diasOptions = [
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' }
  ].map(d => 
    `<option value="${d.value}" ${horario?.diaSemana === d.value ? 'selected' : ''}>${d.label}</option>`
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
               id="hoInicio" value="${horario?.horaInicio || '08:00'}" required>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Fim *</label>
        <input type="time" class="w-full rounded-xl border-gray-200 focus:ring-primary px-4 py-2" 
               id="hoFim" value="${horario?.horaFim || '10:00'}" required>
      </div>
    </div>
    <button type="button" class="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 mt-4" 
            onclick="salvarHorario()">
      ${horario ? 'Atualizar' : 'Salvar'}
    </button>
  `;
  
  abrirModal(horario ? 'Editar Horário' : 'Novo Horário', conteudo);
}

function salvarHorario() {
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

  const conflito = DB.horarios.some(h => 
    h.id !== itemEditandoId &&
    h.diaSemana === diaSemana &&
    ((horaInicio >= h.horaInicio && horaInicio < h.horaFim) ||
     (horaFim > h.horaInicio && horaFim <= h.horaFim) ||
     (horaInicio <= h.horaInicio && horaFim >= h.horaFim))
  );

  if (conflito) {
    toast('Conflito de horário! Já existe uma aula neste período.', 'error');
    return;
  }

  const horario = {
    id: itemEditandoId || uid(),
    materiaId,
    diaSemana,
    horaInicio,
    horaFim
  };

  if (itemEditandoId) {
    const idx = DB.horarios.findIndex(h => h.id === itemEditandoId);
    if (idx !== -1) DB.horarios[idx] = horario;
  } else {
    DB.horarios.push(horario);
  }

  salvarDB();
  fecharModal();
  renderHorarios();
  renderDashboard();
  toast(itemEditandoId ? 'Horário atualizado!' : 'Horário adicionado!');
}

function abrirModalNota(nota = null) {
  itemEditandoId = nota?.id || null;
  
  const materiasOptions = DB.materias.map(m => 
    `<option value="${m.id}" ${nota?.materiaId === m.id ? 'selected' : ''}>${m.nome}</option>`
  ).join('');

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

function salvarNota() {
  const titulo = $('#notaTitulo').value.trim() || 'Sem título';
  const conteudo = $('#notaConteudo').value.trim();
  const materiaId = $('#notaMateria').value;
  const cor = $('#notaCor').value;

  const nota = {
    id: itemEditandoId || uid(),
    titulo,
    conteudo,
    materiaId,
    cor,
    criadoEm: new Date().toISOString()
  };

  if (itemEditandoId) {
    const idx = DB.notas.findIndex(n => n.id === itemEditandoId);
    if (idx !== -1) DB.notas[idx] = nota;
  } else {
    DB.notas.push(nota);
  }

  salvarDB();
  fecharModal();
  renderNotas();
  renderDashboard();
  toast(itemEditandoId ? 'Nota atualizada!' : 'Nota criada!');
}

function toggleTarefa(id) {
  const t = DB.tarefas.find(t => t.id === id);
  if (t) {
    t.concluida = !t.concluida;
    salvarDB();
    renderTarefas();
    renderDashboard();
  }
}

function excluirEvento(id) {
  if (confirm('Excluir este evento?')) {
    // Cancelar notificação antes de excluir
    cancelarNotificacao(id, 'evento');
    DB.eventos = DB.eventos.filter(e => e.id !== id);
    salvarDB();
    renderAgenda();
    renderDashboard();
    toast('Evento excluído!', 'error');
  }
}

function excluirTarefa(id) {
  if (confirm('Excluir esta tarefa?')) {
    // Cancelar notificação antes de excluir
    cancelarNotificacao(id, 'tarefa');
    DB.tarefas = DB.tarefas.filter(t => t.id !== id);
    salvarDB();
    renderTarefas();
    renderDashboard();
    toast('Tarefa excluída!', 'error');
  }
}

function excluirHorario(id) {
  if (confirm('Excluir este horário?')) {
    DB.horarios = DB.horarios.filter(h => h.id !== id);
    salvarDB();
    renderHorarios();
    renderDashboard();
    toast('Horário excluído!', 'error');
  }
}

function excluirMateria(id) {
  if (confirm('Excluir esta matéria?')) {
    DB.materias = DB.materias.filter(m => m.id !== id);
    salvarDB();
    renderMaterias();
    renderDashboard();
    toast('Matéria excluída!', 'error');
  }
}

function excluirNota(id) {
  if (confirm('Excluir esta nota?')) {
    DB.notas = DB.notas.filter(n => n.id !== id);
    salvarDB();
    renderNotas();
    renderDashboard();
    toast('Nota excluída!', 'error');
  }
}

function editarEvento(id) {
  const evento = DB.eventos.find(e => e.id === id);
  if (evento) abrirModalEvento(evento);
}

function editarTarefa(id) {
  const tarefa = DB.tarefas.find(t => t.id === id);
  if (tarefa) abrirModalTarefa(tarefa);
}

function editarHorario(id) {
  const horario = DB.horarios.find(h => h.id === id);
  if (horario) abrirModalHorario(horario);
}

function editarMateria(id) {
  const materia = DB.materias.find(m => m.id === id);
  if (materia) abrirModalMateria(materia);
}

function editarNota(id) {
  const nota = DB.notas.find(n => n.id === id);
  if (nota) abrirModalNota(nota);
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
  $('#modal-import-export').classList.remove('hidden');
  $('#modal-import-export').classList.add('flex');
}

function fecharModalImportExport() {
  $('#modal-import-export').classList.add('hidden');
  $('#modal-import-export').classList.remove('flex');
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

// Solicitar permissão para notificações
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

// Verificar permissão de notificações
function verificarPermissaoNotificacoes() {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

// Mostrar notificação imediata
function mostrarNotificacao(titulo, options = {}) {
  if (!verificarPermissaoNotificacoes()) {
    console.log('Sem permissão para notificações');
    return false;
  }

  const defaultOptions = {
    body: '',
    icon: '/maskable_icon_x192.png',
    badge: '/favicon-32x32.png',
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

// Agendar notificação para um evento
function agendarNotificacaoEvento(evento, minutosAntes = 30) {
  if (!evento || !evento.data || !evento.titulo) return null;
  if (!verificarPermissaoNotificacoes()) return null;
  
  const dataEvento = new Date(`${evento.data}T${evento.hora || '00:00'}`);
  const dataNotificacao = new Date(dataEvento.getTime() - (minutosAntes * 60 * 1000));
  
  // Se já passou, não agenda
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
    
    // Remover da lista de timers
    delete notificationTimers[`evento-${evento.id}`];
  }, tempoMs);
  
  notificationTimers[`evento-${evento.id}`] = timerId;
  return timerId;
}

// Agendar notificação para uma tarefa
function agendarNotificacaoTarefa(tarefa, minutosAntes = 60) {
  if (!tarefa || !tarefa.prazo || !tarefa.titulo) return null;
  if (!verificarPermissaoNotificacoes()) return null;
  
  const dataPrazo = new Date(`${tarefa.prazo}T23:59:59`);
  const dataNotificacao = new Date(dataPrazo.getTime() - (minutosAntes * 60 * 1000));
  
  // Se já passou, não agenda
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
    
    // Remover da lista de timers
    delete notificationTimers[`tarefa-${tarefa.id}`];
  }, tempoMs);
  
  notificationTimers[`tarefa-${tarefa.id}`] = timerId;
  return timerId;
}

// Cancelar notificação agendada
function cancelarNotificacao(id, tipo = 'evento') {
  const key = `${tipo}-${id}`;
  if (notificationTimers[key]) {
    clearTimeout(notificationTimers[key]);
    delete notificationTimers[key];
    return true;
  }
  return false;
}

// Reagendar todas as notificações (ao carregar o app)
function reagendarTodasNotificacoes() {
  if (!verificarPermissaoNotificacoes()) return;
  
  // Cancelar todas existentes
  Object.keys(notificationTimers).forEach(key => {
    clearTimeout(notificationTimers[key]);
  });
  notificationTimers = {};
  
  // Reagendar eventos
  DB.eventos.forEach(evento => {
    if (evento.notificar && evento.notificarMinutos && !evento.concluido) {
      agendarNotificacaoEvento(evento, evento.notificarMinutos);
    }
  });
  
  // Reagendar tarefas
  DB.tarefas.forEach(tarefa => {
    if (tarefa.notificar && tarefa.notificarMinutos && !tarefa.concluida && tarefa.prazo) {
      agendarNotificacaoTarefa(tarefa, tarefa.notificarMinutos);
    }
  });
}

// Adicionar botão flutuante de notificação
function adicionarBotaoNotificacao() {
  // Verificar se já existe
  if ($('#notificacao-btn')) return;
  
  const container = document.createElement('div');
  container.className = 'lg:hidden fixed bottom-32 right-4 z-50';
  container.innerHTML = `
    <button id="notificacao-btn" class="bg-indigo-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-indigo-600 transition-colors" title="Ativar notificações">
      🔔
    </button>
  `;
  document.body.appendChild(container);
  
  const btn = $('#notificacao-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      const granted = await solicitarPermissaoNotificacoes();
      if (granted) {
        toast('✅ Notificações ativadas!');
        btn.innerHTML = '🔔';
        btn.classList.remove('bg-indigo-500');
        btn.classList.add('bg-green-500');
        reagendarTodasNotificacoes();
      } else {
        toast('❌ Permissão negada', 'error');
      }
    });
  }
  
  // Atualizar ícone se já tiver permissão
  if (verificarPermissaoNotificacoes()) {
    btn.innerHTML = '🔔';
    btn.classList.remove('bg-indigo-500');
    btn.classList.add('bg-green-500');
  }
}

function init() {
  console.log('Inicializando UniAgenda...');
  
  carregarDB();

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

  const btnAdd = $('#btn-add');
  if (btnAdd) {
    btnAdd.addEventListener('click', handleAddButton);
  }

  $('#modal-close')?.addEventListener('click', fecharModal);
  $('#modal-backdrop')?.addEventListener('click', fecharModal);

  $('#btn-importar')?.addEventListener('click', () => {
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
            if (confirm('Isso substituirá todos os dados. Deseja continuar?')) {
              DB = dados;
              salvarDB();
              navigateTo(paginaAtual);
              toast('Dados importados!');
            }
          } catch (erro) {
            toast('Arquivo inválido!', 'error');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  });

  $('#btn-exportar')?.addEventListener('click', () => {
    exportarArquivo();
  });

  const mobileDataBtn = $('#mobile-data-btn');
  if (mobileDataBtn) {
    mobileDataBtn.addEventListener('click', abrirModalImportExport);
  }

  $('#modal-ie-close')?.addEventListener('click', fecharModalImportExport);
  $('#modal-ie-backdrop')?.addEventListener('click', fecharModalImportExport);
  $('#mobile-export-btn')?.addEventListener('click', exportarArquivo);
  $('#mobile-import-btn')?.addEventListener('click', importarArquivo);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fecharModal();
      fecharModalImportExport();
    }
  });

  $('#filtroPrioridade')?.addEventListener('change', renderTarefas);
  $('#filtroMateriaTarefa')?.addEventListener('change', renderTarefas);
  $('#filtroStatusTarefa')?.addEventListener('change', renderTarefas);
  $('#busca-notas')?.addEventListener('input', renderNotas);
  $('#btn-busca-notas')?.addEventListener('click', renderNotas);
  $('#filtroTipoEvento')?.addEventListener('change', renderAgenda);
  $('#filtroMateriaEvento')?.addEventListener('change', renderAgenda);
  
  // Inicializar notificações
  if (verificarPermissaoNotificacoes()) {
    console.log('✅ Notificações permitidas');
    reagendarTodasNotificacoes();
  }
  
  // Adicionar botão de notificação
  adicionarBotaoNotificacao();
  
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

// Exportar funções de notificação
window.solicitarPermissaoNotificacoes = solicitarPermissaoNotificacoes;
window.mostrarNotificacao = mostrarNotificacao;