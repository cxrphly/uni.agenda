// data.js - Serviço de dados com Supabase
(function() {
  class DataService {
    constructor() {
      this.supabase = null;
      this.localDB = {
        materias: [],
        eventos: [],
        tarefas: [],
        notas: [],
        horarios: []
      };
      this.initialized = false;
      this.syncInProgress = false;
      this.config = window.appConfig?.supabase;
    }

    async init() {
      if (this.initialized) return;

      try {
        console.log('🔄 Inicializando Supabase...');
        
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0');
        
        this.supabase = createClient(this.config.url, this.config.anonKey);
        this.loadFromLocalStorage();

        if (window.auth) {
          window.auth.addListener(async (user) => {
            if (user) {
              await this.syncWithServer();
            }
          });
        }

        this.initialized = true;
        console.log('✅ DataService inicializado');
      } catch (error) {
        console.error('❌ Erro ao inicializar Supabase:', error);
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

    async syncWithServer() {
      if (!navigator.onLine || !window.auth?.isAuthenticated() || this.syncInProgress) {
        return;
      }

      this.syncInProgress = true;
      this.showSyncIndicator('Sincronizando...');

      try {
        const userId = window.auth.getUserId();
        console.log('🔄 Sincronizando dados para usuário:', userId);
        
        const tabelas = ['materias', 'eventos', 'tarefas', 'notas', 'horarios'];
        
        for (const tabela of tabelas) {
          const pendingItems = (this.localDB[tabela] || []).filter(i => i.sync_status === 'pending');
          
          for (const item of pendingItems) {
            const { error } = await this.supabase
              .from(tabela)
              .upsert({
                ...item,
                user_id: userId,
                sync_status: 'synced'
              });

            if (!error) {
              item.sync_status = 'synced';
            }
          }

          const { data: serverItems, error } = await this.supabase
            .from(tabela)
            .select('*')
            .eq('user_id', userId);

          if (!error && serverItems) {
            if (!this.localDB[tabela]) this.localDB[tabela] = [];
            
            serverItems.forEach(serverItem => {
              const localIndex = this.localDB[tabela].findIndex(i => i.id === serverItem.id);
              if (localIndex >= 0) {
                this.localDB[tabela][localIndex] = serverItem;
              } else {
                this.localDB[tabela].push(serverItem);
              }
            });
          }
        }

        this.saveToLocalStorage();
        this.hideSyncIndicator();
        
        if (window.renderPagina) {
          window.renderPagina(window.paginaAtual);
        }
        
        this.showToast('✅ Dados sincronizados!');
        
      } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        this.showToast('❌ Erro ao sincronizar', 'error');
      } finally {
        this.syncInProgress = false;
        this.hideSyncIndicator();
      }
    }

    showSyncIndicator(message) {
      const indicator = document.getElementById('sync-indicator');
      const messageEl = document.getElementById('sync-message');
      if (indicator) {
        if (messageEl) messageEl.textContent = message;
        indicator.classList.remove('hidden');
      }
    }

    hideSyncIndicator() {
      const indicator = document.getElementById('sync-indicator');
      if (indicator) indicator.classList.add('hidden');
    }

    // CRUD methods
    async getAll(tabela) {
      if (!window.auth?.isAuthenticated()) return [];
      return this.localDB[tabela] || [];
    }

    async getById(tabela, id) {
      if (!window.auth?.isAuthenticated()) return null;
      return this.localDB[tabela]?.find(i => i.id === id);
    }

    async save(tabela, item) {
      if (!window.auth?.isAuthenticated()) {
        this.showToast('Faça login para salvar dados', 'error');
        return null;
      }

      if (!this.localDB[tabela]) this.localDB[tabela] = [];
      
      const index = this.localDB[tabela].findIndex(i => i.id === item.id);
      
      const itemWithSync = {
        ...item,
        sync_status: navigator.onLine && window.auth?.isAuthenticated() ? 'synced' : 'pending',
        updated_at: new Date().toISOString(),
        user_id: window.auth.getUserId()
      };

      if (index >= 0) {
        this.localDB[tabela][index] = itemWithSync;
      } else {
        this.localDB[tabela].push(itemWithSync);
      }

      this.saveToLocalStorage();

      if (navigator.onLine && window.auth?.isAuthenticated()) {
        await this.syncItem(tabela, itemWithSync);
      }

      return itemWithSync;
    }

    async delete(tabela, id) {
      if (!window.auth?.isAuthenticated()) {
        this.showToast('Faça login para excluir dados', 'error');
        return;
      }

      if (!this.localDB[tabela]) return;
      
      this.localDB[tabela] = this.localDB[tabela].filter(i => i.id !== id);
      this.saveToLocalStorage();

      if (navigator.onLine && window.auth?.isAuthenticated()) {
        await this.supabase.from(tabela).delete().eq('id', id);
      }
    }

    async syncItem(tabela, item) {
      if (!navigator.onLine || !window.auth?.isAuthenticated()) return;

      try {
        const { error } = await this.supabase
          .from(tabela)
          .upsert(item);

        if (!error) {
          item.sync_status = 'synced';
          this.saveToLocalStorage();
        }
      } catch (error) {
        console.error(`Erro ao sincronizar ${tabela}:`, error);
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
        await this.syncWithServer();
      }
    }

    showToast(message, type = 'success') {
      if (window.toast) {
        window.toast(message, type);
      } else {
        console.log(message);
      }
    }
  }

  window.data = new DataService();
})();