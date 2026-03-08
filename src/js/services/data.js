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
        
        this.loadFromLocalStorage();
        
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0');
        this.supabase = createClient(
          window.appConfig.supabase.url,
          window.appConfig.supabase.anonKey
        );
        
        if (window.auth?.isAuthenticated()) {
        }
        
        this.initialized = true;
      } catch (error) {
        console.error('❌ Erro ao inicializar DataService:', error);
      }
    }

  
    loadFromLocalStorage() {
      const saved = localStorage.getItem('uniagenda_db');
      if (saved) {
        try {
          this.localDB = JSON.parse(saved);
        } catch (e) {
          console.error('Erro ao carregar dados locais:', e);
        }
      }
    }

    saveToLocalStorage() {
      localStorage.setItem('uniagenda_db', JSON.stringify(this.localDB));
    }


    async pullFromServer(isFirstLoad = false) {
      if (!this.supabase || !window.auth?.isAuthenticated()) return;

      try {
        const userId = window.auth.getUserId();
        console.log(`📥 Puxando dados do servidor...`);
        
        const tabelas = ['materias', 'eventos', 'tarefas', 'notas', 'horarios'];
        let alteracoes = false;
        
        for (const tabela of tabelas) {
          const { data: serverItems, error } = await this.supabase
            .from(tabela)
            .select('*')
            .eq('user_id', userId);

          if (error) {
            console.error(`Erro ao buscar ${tabela}:`, error);
            continue;
          }

          if (!serverItems) continue;
          
          if (isFirstLoad) {
            this.localDB[tabela] = serverItems.map(item => ({
              ...item,
              sync_status: 'synced'
            }));
            alteracoes = true;
            continue;
          }
          
          const serverMap = new Map(serverItems.map(item => [item.id, item]));
          const localItems = this.localDB[tabela] || [];
          
          const pendingItems = localItems.filter(item => item.sync_status === 'pending');
          const syncedItems = localItems.filter(item => item.sync_status !== 'pending');
          
          const syncedMap = new Map(syncedItems.map(item => [item.id, item]));
          
          const novosItems = [];
          for (const [id, serverItem] of serverMap) {
            if (!syncedMap.has(id)) {
              novosItems.push({
                ...serverItem,
                sync_status: 'synced'
              });
            }
          }
          
          if (novosItems.length > 0) {
            alteracoes = true;
          }
          
          for (const [id, serverItem] of serverMap) {
            const localItem = syncedMap.get(id);
            if (localItem) {
              const serverTime = new Date(serverItem.updated_at).getTime();
              const localTime = new Date(localItem.updated_at).getTime();
              
              if (serverTime > localTime) {
                console.log(`📝 ${tabela}: Atualizando ${id} (servidor mais recente)`);
                localItem.nome = serverItem.nome;
                localItem.professor = serverItem.professor;
                localItem.sala = serverItem.sala;
                localItem.max_faltas = serverItem.max_faltas;
                localItem.faltas = serverItem.faltas;
                localItem.cor = serverItem.cor;
                localItem.updated_at = serverItem.updated_at;
                alteracoes = true;
              }
            }
          }
          
          const excluidos = [];
          for (const [id, localItem] of syncedMap) {
            if (!serverMap.has(id)) {
              excluidos.push(id);
            }
          }
          
          if (excluidos.length > 0) {
            alteracoes = true;
          }
          
          this.localDB[tabela] = [
            ...novosItems,
            ...syncedItems.filter(item => !excluidos.includes(item.id)),
            ...pendingItems
          ];
        }
        
        if (alteracoes) {
          this.saveToLocalStorage();
        }
        
      } catch (error) {
        console.error('❌ Erro ao puxar dados do servidor:', error);
      }
    }

    async pushToSupabase(tabela, item) {
      if (!this.supabase || !window.auth?.isAuthenticated()) return false;

      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        if (!uuidRegex.test(item.id)) {
          console.warn(`⚠️ Ignorando item com ID inválido: ${item.id}`);
          return false;
        }
        
        console.log(`📤 Enviando para Supabase [${tabela}]:`, item.id);
        
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
        
        const { data, error } = await this.supabase
          .from(tabela)
          .upsert(itemToSend, { onConflict: 'id' })
          .select();

        if (error) {
          console.error(`❌ Erro no upsert ${tabela}:`, error);
          return false;
        }

        console.log(`✅ Sincronizado [${tabela}]:`, item.id);
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
        this._mostrarToast('Faça login para salvar dados', 'error');
        return null;
      }

      console.log(`💾 Salvando [${tabela}]:`, item.id || 'novo');
      
      if (!this.localDB[tabela]) this.localDB[tabela] = [];
      
      const index = this.localDB[tabela].findIndex(i => i.id === item.id);
      
      const itemWithMeta = {
        ...item,
        user_id: window.auth.getUserId(),
        updated_at: new Date().toISOString(),
        sync_status: navigator.onLine ? 'synced' : 'pending'
      };

      if (index >= 0) {
        this.localDB[tabela][index] = itemWithMeta;
      } else {
        this.localDB[tabela].push(itemWithMeta);
      }

      this.saveToLocalStorage();
      
      if (navigator.onLine) {
        const sucesso = await this.pushToSupabase(tabela, itemWithMeta);
        if (sucesso) {
          itemWithMeta.sync_status = 'synced';
          this.saveToLocalStorage();
        }
      }

      return itemWithMeta;
    }

    async delete(tabela, id) {
      if (!window.auth?.isAuthenticated()) {
        this._mostrarToast('Faça login para excluir dados', 'error');
        return;
      }

      console.log(`🗑️ Deletando [${tabela}]:`, id);
      
      if (!this.localDB[tabela]) return;
      
      const itemRemovido = this.localDB[tabela].find(i => i.id === id);
      
      // Remover localmente
      this.localDB[tabela] = this.localDB[tabela].filter(i => i.id !== id);
      this.saveToLocalStorage();

      if (navigator.onLine && this.supabase) {
        try {
          const { error } = await this.supabase
            .from(tabela)
            .delete()
            .eq('id', id)
            .eq('user_id', window.auth.getUserId());

          if (error) throw error;
          
          console.log(`✅ Deletado do servidor [${tabela}]`);
          
          setTimeout(() => this.pullFromServer(), 500);
          
        } catch (error) {
          console.error('❌ Erro ao deletar do servidor:', error);
          
          if (itemRemovido) {
            this.localDB[tabela].push({
              ...itemRemovido,
              sync_status: 'pending'
            });
            this.saveToLocalStorage();
          }
          
          this._mostrarToast('Erro ao deletar. Tente novamente.', 'error');
        }
      } else {
        if (itemRemovido) {
          this.localDB[tabela].push({
            ...itemRemovido,
            sync_status: 'pending_delete',
            deleted: true
          });
          this.saveToLocalStorage();
        }
      }
    }


    async syncAll() {
      if (!navigator.onLine || !window.auth?.isAuthenticated()) {
        this._mostrarToast('Offline ou não logado', 'error');
        return;
      }

      console.log('🔄 Iniciando sincronização completa...');
      this._mostrarToast('Sincronizando...', 'info');

      try {
        let enviados = 0;
        let pendentes = 0;
        
        for (const [tabela, items] of Object.entries(this.localDB)) {
          for (const item of items) {
            if (item.sync_status === 'pending' || item.sync_status === 'pending_delete') {
              pendentes++;
              
              if (item.deleted) {
                try {
                  await this.supabase
                    .from(tabela)
                    .delete()
                    .eq('id', item.id)
                    .eq('user_id', window.auth.getUserId());
                  
                  this.localDB[tabela] = this.localDB[tabela].filter(i => i.id !== item.id);
                  enviados++;
                  
                } catch (error) {
                  console.error(`Erro ao processar exclusão pendente:`, error);
                }
              } else {
                const sucesso = await this.pushToSupabase(tabela, item);
                if (sucesso) {
                  item.sync_status = 'synced';
                  enviados++;
                }
              }
            }
          }
        }
        
        if (enviados > 0) {
          this.saveToLocalStorage();
          console.log(`📤 Enviados ${enviados} de ${pendentes} itens pendentes`);
        }
        
        await this.pullFromServer();
        
        if (window.renderPagina) {
          window.renderPagina(window.paginaAtual);
        }
        
        this._mostrarToast('✅ Sincronização concluída!', 'success');
        
      } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        this._mostrarToast('Erro na sincronização', 'error');
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

    _mostrarToast(mensagem, tipo = 'success') {
      if (window.toast) {
        if (tipo === 'success') window.toast.success(mensagem);
        else if (tipo === 'error') window.toast.error(mensagem);
        else if (tipo === 'info') window.toast.info(mensagem);
        else window.toast(mensagem, tipo);
      } else {
        console.log(mensagem);
      }
    }
  }

  window.data = new DataService();
})();