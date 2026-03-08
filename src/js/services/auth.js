// auth.js - Serviço de autenticação com Supabase
(function() {
  class AuthService {
    constructor() {
      // Verificar se já existe uma instância global
      if (window.__supabaseAuthInstance) {
        return window.__supabaseAuthInstance;
      }
      
      this.supabase = null;
      this.user = null;
      this.session = null;
      this.listeners = [];
      this.initialized = false;
      this.initPromise = null;
      this.config = window.appConfig?.supabase;
      this.clientInitialized = false;
      
      // Salvar a instância globalmente
      window.__supabaseAuthInstance = this;
    }

    async init() {
      if (this.initialized) return Promise.resolve();
      if (this.initPromise) return this.initPromise;

      this.initPromise = new Promise(async (resolve, reject) => {
        try {
          
          if (!this.config || !this.config.url || !this.config.anonKey) {
            throw new Error('Configuração do Supabase não encontrada');
          }
          
          // Verificar se já existe um cliente Supabase global
          if (!window.__supabaseClient) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0');
            
            // Configurações para evitar múltiplas instâncias
            window.__supabaseClient = createClient(this.config.url, this.config.anonKey, {
              auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                storageKey: 'uniagenda-auth-storage', // Chave única para o storage
                storage: localStorage // Usar localStorage explicitamente
              }
            });
          } else {
            console.log('📢 Reutilizando cliente Supabase existente');
          }
          
          this.supabase = window.__supabaseClient;
          
          // Verificar sessão existente
          const { data: { session } } = await this.supabase.auth.getSession();
          this.session = session;
          this.user = session?.user ?? null;
          
          // Remover listener anterior se existir
          if (this.authListener) {
            this.authListener.unsubscribe();
          }
          
          // Listener para mudanças de auth
          this.authListener = this.supabase.auth.onAuthStateChange((event, session) => {
            this.session = session;
            this.user = session?.user ?? null;
            this.notifyListeners();
            this.updateUI();
          });

          this.initialized = true;
          this.updateUI();
          
          resolve();
        } catch (error) {
          console.error('❌ Erro ao inicializar Supabase Auth:', error);
          reject(error);
        }
      });

      return this.initPromise;
    }

    async ensureInitialized() {
      if (!this.initialized) {
        await this.init();
      }
      return this.supabase;
    }

    updateUI() {
      const logoutBtn = document.getElementById('logout-container');
      const mainContent = document.getElementById('main-content');
      const installPwa = document.getElementById('install-pwa-container');
      
      if (this.user) {
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('opacity-50', 'pointer-events-none');
        // NÃO controlar o banner pelo auth - REMOVIDO
        // if (installPwa) installPwa.classList.remove('hidden');
      } else {
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (mainContent) {
          mainContent.classList.add('opacity-50', 'pointer-events-none');
        }
        // Esconder banner quando deslogado (opcional)
        if (installPwa) installPwa.classList.add('hidden');
      }
    }

    showLoader(message = 'Processando...') {
      const loader = document.getElementById('global-loader');
      const msgEl = document.getElementById('loader-message');
      if (loader) {
        if (msgEl) msgEl.textContent = message;
        loader.classList.remove('hidden');
        loader.classList.add('flex');
      }
    }

    hideLoader() {
      const loader = document.getElementById('global-loader');
      if (loader) {
        loader.classList.add('hidden');
        loader.classList.remove('flex');
      }
    }

    showError(message) {
      const errorEl = document.getElementById('error-message');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        setTimeout(() => errorEl.classList.add('hidden'), 5000);
      } else {
        console.error(message);
      }
    }

    showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      
      const toast = document.createElement('div');
      toast.className = `bg-${type === 'success' ? 'green' : 'red'}-500 text-white px-4 py-2 rounded-lg shadow-lg mb-2`;
      toast.textContent = message;
      container.appendChild(toast);
      
      setTimeout(() => toast.remove(), 3000);
    }

    async loginWithEmail(email, password) {
      try {
        await this.ensureInitialized();
        this.showLoader('Verificando...');
        
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email,
          password
        });
        
        this.hideLoader();
        
        if (error) throw error;
        
        return { success: true, user: data.user };
      } catch (error) {
        this.hideLoader();
        console.error('Erro login:', error);
        return { 
          success: false, 
          error: error.message || 'Erro ao fazer login' 
        };
      }
    }

    async registerWithEmail(email, password, name) {
      try {
        await this.ensureInitialized();
        this.showLoader('Criando sua conta...');
        
        const { data, error } = await this.supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            }
          }
        });
        
        this.hideLoader();
        
        if (error) throw error;
        
        return { success: true, user: data.user };
      } catch (error) {
        this.hideLoader();
        console.error('Erro no registro:', error);
        return { 
          success: false, 
          error: error.message || 'Erro ao cadastrar' 
        };
      }
    }

    async logout() {
      try {
        await this.ensureInitialized();
        this.showLoader('Saindo...');
        await this.supabase.auth.signOut();
        this.hideLoader();
        window.location.href = '/login';
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
        this.hideLoader();
      }
    }

    async checkAuthAndRedirect() {
      await this.ensureInitialized();
      
      if (this.user) {
        window.location.href = '/';
        return true;
      }
      return false;
    }

    isAuthenticated() {
      return !!this.user;
    }

    getUserId() {
      return this.user?.id;
    }

    getUser() {
      return this.user;
    }

    addListener(callback) {
      this.listeners.push(callback);
      if (this.user) callback(this.user);
    }

    notifyListeners() {
      this.listeners.forEach(cb => cb(this.user));
    }
  }

  // Limpar instância global ao recarregar a página
  window.addEventListener('beforeunload', () => {
    window.__supabaseClient = null;
  });

  window.auth = new AuthService();
})();