// data.js - Serviço de dados simplificado com Supabase direto
(function() {
  class DataService {
    constructor() {
      this.localDB = {
        materias: [],
        eventos: [],
        tarefas: [],
        notas: [],
        horarios: []
      };
      this.supabase = null;
      this.initialized = false;
    }

    async init() {
      if (this.initialized) return;

      try {
        console.log('🔄 Inicializando DataService...');
        
        // Carregar dados do localStorage primeiro
        this.loadFromLocalStorage();
        
        // Inicializar cliente Supabase
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0');
        this.supabase = createClient(
          window.appConfig.supabase.url,
          window.appConfig.supabase.anonKey
        );
        
        // Se estiver logado, buscar dados do Supabase
        if (window.auth?.isAuthenticated()) {
          await this.pullFromSupabase();
        }
        
        this.initialized = true;
        console.log('✅ DataService inicializado');
      } catch (error) {
        console.error('❌ Erro ao inicializar DataService:', error);
      }
    }

    loadFromLocalStorage() {
      const saved = localStorage.getItem('uniagenda_db');
      if (saved) {
        try {
          this.localDB = JSON.parse(saved);
          console.log('📦 Dados carregados do localStorage');
        } catch (e) {
          console.error('Erro ao carregar dados locais:', e);
        }
      }
    }

    saveToLocalStorage() {
      localStorage.setItem('uniagenda_db', JSON.stringify(this.localDB));
    }

    async pullFromSupabase() {
      if (!this.supabase || !window.auth?.isAuthenticated()) return;

      try {
        const userId = window.auth.getUserId();
        console.log('📥 Buscando dados do Supabase para:', userId);
        
        const tabelas = ['materias', 'eventos', 'tarefas', 'notas', 'horarios'];
        
        for (const tabela of tabelas) {
          const { data, error } = await this.supabase
            .from(tabela)
            .select('*')
            .eq('user_id', userId);

          if (error) {
            console.error(`Erro ao buscar ${tabela}:`, error);
            continue;
          }

          if (data && data.length > 0) {
            console.log(`📥 Recebidos ${data.length} registros de ${tabela}`);
            this.localDB[tabela] = data;
          }
        }
        
        this.saveToLocalStorage();
        console.log('✅ Dados sincronizados do Supabase');
      } catch (error) {
        console.error('❌ Erro ao buscar dados do Supabase:', error);
      }
    }

async pushToSupabase(tabela, item) {
  if (!this.supabase || !window.auth?.isAuthenticated()) return false;

  try {
    // VALIDAÇÃO DE ID - UUID VÁLIDO
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (!uuidRegex.test(item.id)) {
      console.warn(`⚠️ Ignorando item com ID inválido: ${item.id}`);
      return false;
    }
    
    console.log(`📤 Enviando para Supabase [${tabela}]:`, item);
    
    // Garantir que o ID seja string
    const baseItem = {
      ...item,
      id: String(item.id),
      user_id: window.auth.getUserId(),
      updated_at: new Date().toISOString()
    };
    
    // Mapeamento específico por tabela
    let itemToSend;
    
    switch(tabela) {
      case 'materias':
        itemToSend = {
          id: baseItem.id,
          user_id: baseItem.user_id,
          nome: baseItem.nome,
          professor: baseItem.professor,
          sala: baseItem.sala,
          max_faltas: baseItem.max_faltas || baseItem.maxFaltas,
          faltas: baseItem.faltas,
          cor: baseItem.cor,
          updated_at: baseItem.updated_at
        };
        break;
        
      case 'eventos':
        itemToSend = {
          id: baseItem.id,
          user_id: baseItem.user_id,
          materia_id: baseItem.materia_id || baseItem.materiaId,
          titulo: baseItem.titulo,
          tipo: baseItem.tipo,
          data: baseItem.data,
          hora: baseItem.hora,
          descricao: baseItem.descricao,
          notificar: baseItem.notificar,
          notificar_minutos: baseItem.notificar_minutos || baseItem.notificarMinutos,
          concluido: baseItem.concluido,
          updated_at: baseItem.updated_at
        };
        break;
        
      case 'tarefas':
        itemToSend = {
          id: baseItem.id,
          user_id: baseItem.user_id,
          materia_id: baseItem.materia_id || baseItem.materiaId,
          titulo: baseItem.titulo,
          prioridade: baseItem.prioridade,
          prazo: baseItem.prazo,
          concluida: baseItem.concluida,
          notificar: baseItem.notificar,
          notificar_minutos: baseItem.notificar_minutos || baseItem.notificarMinutos,
          updated_at: baseItem.updated_at
        };
        break;
        
      case 'notas':
        itemToSend = {
          id: baseItem.id,
          user_id: baseItem.user_id,
          materia_id: baseItem.materia_id || baseItem.materiaId,
          titulo: baseItem.titulo,
          conteudo: baseItem.conteudo,
          cor: baseItem.cor,
          updated_at: baseItem.updated_at
        };
        break;
        
      case 'horarios':
        itemToSend = {
          id: baseItem.id,
          user_id: baseItem.user_id,
          materia_id: baseItem.materia_id || baseItem.materiaId,
          dia_semana: baseItem.diaSemana || baseItem.dia_semana,
          hora_inicio: baseItem.horaInicio || baseItem.hora_inicio,
          hora_fim: baseItem.horaFim || baseItem.hora_fim,
          updated_at: baseItem.updated_at
        };
        break;
        
      default:
        itemToSend = baseItem;
    }
    
    console.log(`📤 Dados formatados:`, itemToSend);
    
    const { data, error } = await this.supabase
      .from(tabela)
      .upsert(itemToSend, { onConflict: 'id' })
      .select();

    if (error) {
      console.error(`❌ Erro no upsert ${tabela}:`, error);
      return false;
    }

    console.log(`✅ Dados sincronizados com Supabase [${tabela}]:`, data);
    return true;
  } catch (error) {
    console.error(`❌ Erro na sincronização ${tabela}:`, error);
    return false;
  }
}
    async getAll(tabela) {
      return this.localDB[tabela] || [];
    }

    async getById(tabela, id) {
      return this.localDB[tabela]?.find(i => i.id === id);
    }

    async save(tabela, item) {
      if (!window.auth?.isAuthenticated()) {
        toast('Faça login para salvar dados', 'error');
        return null;
      }

      console.log(`💾 Salvando [${tabela}]:`, item.id || 'novo');
      
      if (!this.localDB[tabela]) this.localDB[tabela] = [];
      
      const index = this.localDB[tabela].findIndex(i => i.id === item.id);
      
      const itemWithMeta = {
        ...item,
        user_id: window.auth.getUserId(),
        updated_at: new Date().toISOString()
      };

      if (index >= 0) {
        this.localDB[tabela][index] = itemWithMeta;
        console.log(`📝 Item atualizado`);
      } else {
        this.localDB[tabela].push(itemWithMeta);
        console.log(`➕ Novo item adicionado`);
      }

      this.saveToLocalStorage();
      
      // TENTAR SINCRONIZAR IMEDIATAMENTE COM SUPABASE
      if (navigator.onLine) {
        await this.pushToSupabase(tabela, itemWithMeta);
      }

      return itemWithMeta;
    }

    async delete(tabela, id) {
      if (!window.auth?.isAuthenticated()) {
        toast('Faça login para excluir dados', 'error');
        return;
      }

      console.log(`🗑️ Deletando [${tabela}]:`, id);
      
      if (!this.localDB[tabela]) return;
      
      this.localDB[tabela] = this.localDB[tabela].filter(i => i.id !== id);
      this.saveToLocalStorage();

      if (navigator.onLine && this.supabase) {
        try {
          await this.supabase
            .from(tabela)
            .delete()
            .eq('id', id)
            .eq('user_id', window.auth.getUserId());
          console.log(`✅ Deletado do Supabase [${tabela}]`);
        } catch (error) {
          console.error('❌ Erro ao deletar do Supabase:', error);
        }
      }
    }

    async syncAll() {
      if (!navigator.onLine || !window.auth?.isAuthenticated()) {
        toast('Offline ou não logado', 'error');
        return;
      }

      console.log('🔄 Sincronizando todos os dados...');
      
      for (const [tabela, items] of Object.entries(this.localDB)) {
        for (const item of items) {
          await this.pushToSupabase(tabela, item);
        }
      }
      
      await this.pullFromSupabase();
      
      toast('✅ Sincronização concluída!');
      
      if (window.renderPagina) {
        window.renderPagina(window.paginaAtual);
      }
    }

    getDB() {
      return this.localDB;
    }

    setDB(newDB) {
      this.localDB = newDB;
      this.saveToLocalStorage();
    }

    async importFromJSON(jsonData) {
      this.localDB = jsonData;
      this.saveToLocalStorage();
      
      if (navigator.onLine && window.auth?.isAuthenticated()) {
        await this.syncAll();
      }
    }
  }

  window.data = new DataService();
})();