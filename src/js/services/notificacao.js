(function() {
  class NotificacaoService {
    constructor() {
      this.permissao = false;
      this.timers = {};
      this.ativos = [];
      this.subscription = null;
      this.registration = null;
      this.deviceId = this._getDeviceId();
      this.dispositivos = [];
      this.auth = window.auth;
    }


    _getDeviceId() {
      let deviceId = localStorage.getItem('uniagenda_device_id');
      if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('uniagenda_device_id', deviceId);
      }
      return deviceId;
    }

    _getDeviceType() {
      const ua = navigator.userAgent;
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
      }
      if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
        return 'mobile';
      }
      return 'desktop';
    }

    async _getToken() {
      try {
        if (!window.auth?.supabase) {
          console.warn('⚠️ Auth não disponível');
          return null;
        }
        const { data: { session } } = await window.auth.supabase.auth.getSession();
        return session?.access_token;
      } catch (error) {
        console.error('Erro ao pegar token:', error);
        return null;
      }
    }

    _mostrarMensagem(mensagem, tipo = 'success') {
      if (window.toast) {
        if (tipo === 'success') window.toast.success(mensagem);
        else if (tipo === 'error') window.toast.error(mensagem);
        else if (tipo === 'warning') window.toast.warning(mensagem);
        else window.toast.info(mensagem);
      } else {
        alert(mensagem);
      }
    }

    _urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

  
    async init() {

      if (!('Notification' in window)) {
        console.warn('❌ Navegador não suporta notificações');
        return;
      }

      this.permissao = Notification.permission === 'granted';
      this._carregarAtivos();

      await this._registrarServiceWorker();

      if (this.permissao && window.auth?.isAuthenticated()) {
        await this._inscreverPush();
        await this._sincronizarDispositivos();
      }

      console.log('✅ Notificações inicializadas', {
        permissao: this.permissao,
        deviceType: this._getDeviceType(),
        deviceId: this.deviceId
      });
    }

    async _registrarServiceWorker() {
      if ('serviceWorker' in navigator) {
        try {
          this.registration = await navigator.serviceWorker.ready;
          console.log('👷 Service Worker pronto');
        } catch (err) {
          console.error('❌ Erro no Service Worker:', err);
        }
      }
    }


    async _inscreverPush() {
      if (!this.registration || !this.permissao) return false;

      try {
        const token = await this._getToken();
        if (!token) {
          console.error('❌ Usuário não autenticado');
          return false;
        }

        const response = await fetch('/api/push-keys');
        const { publicKey } = await response.json();

        const applicationServerKey = this._urlBase64ToUint8Array(publicKey);

        let subscription = await this.registration.pushManager.getSubscription();
        
        if (!subscription) {
          subscription = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
        }

        this.subscription = subscription;

        const subscribeResponse = await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            subscription: this.subscription,
            deviceId: this.deviceId,
            deviceType: this._getDeviceType(),
            userAgent: navigator.userAgent
          })
        });

        if (!subscribeResponse.ok) {
          throw new Error('Erro ao inscrever no servidor');
        }

        console.log('📱 Inscrito em notificações push');
        return true;
      } catch (error) {
        console.error('Erro ao inscrever em push:', error);
        return false;
      }
    }

    async _desinscreverPush() {
      if (!this.subscription) return;

      try {
        const token = await this._getToken();
        if (!token) return;

        await this.subscription.unsubscribe();
        
        await fetch('/api/push-unsubscribe', {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            endpoint: this.subscription.endpoint,
            deviceId: this.deviceId
          })
        });

        this.subscription = null;
        console.log('📱 Desinscrito de notificações push');
      } catch (error) {
        console.error('Erro ao desinscrever:', error);
      }
    }


    async _sincronizarDispositivos() {
      try {
        const token = await this._getToken();
        if (!token) return;

        const response = await fetch('/api/push-dispositivos', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ deviceId: this.deviceId })
        });
        
        if (!response.ok) {
          throw new Error('Erro ao sincronizar dispositivos');
        }

        const data = await response.json();
        this.dispositivos = data.dispositivos || [];
        
        console.log(`📱 ${this.dispositivos.length} dispositivo(s) conectado(s)`);
      } catch (error) {
        console.error('Erro ao sincronizar dispositivos:', error);
      }
    }


    async solicitarPermissao() {
      if (!('Notification' in window)) {
        this._mostrarMensagem('Seu navegador não suporta notificações', 'error');
        return false;
      }

      if (this.permissao) {
        return true;
      }

      try {
        const permissao = await Notification.requestPermission();
        this.permissao = permissao === 'granted';

        if (this.permissao) {
          this._mostrarMensagem('✅ Notificações ativadas!', 'success');
          
          if (window.auth?.isAuthenticated()) {
            await this._inscreverPush();
            await this._sincronizarDispositivos();
            this._reagendarTodas();
          } else {
            this._mostrarMensagem('Faça login para sincronizar entre dispositivos', 'info');
          }
        } else {
          this._mostrarMensagem('❌ Permissão negada', 'error');
        }

        return this.permissao;
      } catch (error) {
        console.error('Erro ao solicitar permissão:', error);
        this._mostrarMensagem('Erro ao ativar notificações', 'error');
        return false;
      }
    }

    agendarEvento(evento) {
      if (!evento?.data || !evento?.titulo) return null;
      if (!this.permissao) return null;
      if (!evento.notificar) return null;

      const dataEvento = new Date(`${evento.data}T${evento.hora || '12:00'}`);
      const minutosAntes = evento.notificar_minutos || 30;
      const dataNotificacao = new Date(dataEvento.getTime() - (minutosAntes * 60 * 1000));

      if (dataNotificacao <= new Date()) return null;

      const tempoMs = dataNotificacao.getTime() - Date.now();
      const id = `evento-${evento.id}-${this.deviceId}`;

      this.cancelar(id);

      const timerId = setTimeout(() => {
        this._enviarNotificacaoEvento(evento, minutosAntes);
        
        if (window.auth?.isAuthenticated()) {
          this._enviarPushParaOutrosDispositivos({
            tipo: 'evento',
            titulo: evento.titulo,
            data: evento.data,
            hora: evento.hora,
            minutosAntes,
            id: evento.id
          });
        }

        delete this.timers[id];
        this._removerAtivo(id);
      }, tempoMs);

      this.timers[id] = timerId;
      this._salvarAtivo({
        id,
        tipo: 'evento',
        titulo: evento.titulo,
        data: dataNotificacao.toISOString(),
        itemId: evento.id,
        deviceId: this.deviceId
      });

      return timerId;
    }

    agendarTarefa(tarefa) {
      if (!tarefa?.prazo || !tarefa?.titulo) return null;
      if (!this.permissao) return null;
      if (!tarefa.notificar) return null;

      const dataPrazo = new Date(`${tarefa.prazo}T23:59:59`);
      const minutosAntes = tarefa.notificar_minutos || 60;
      const dataNotificacao = new Date(dataPrazo.getTime() - (minutosAntes * 60 * 1000));

      if (dataNotificacao <= new Date()) return null;

      const tempoMs = dataNotificacao.getTime() - Date.now();
      const id = `tarefa-${tarefa.id}-${this.deviceId}`;

      this.cancelar(id);

      const timerId = setTimeout(() => {
        this._enviarNotificacaoTarefa(tarefa, minutosAntes);
        
        if (window.auth?.isAuthenticated()) {
          this._enviarPushParaOutrosDispositivos({
            tipo: 'tarefa',
            titulo: tarefa.titulo,
            prazo: tarefa.prazo,
            prioridade: tarefa.prioridade,
            minutosAntes,
            id: tarefa.id
          });
        }

        delete this.timers[id];
        this._removerAtivo(id);
      }, tempoMs);

      this.timers[id] = timerId;
      this._salvarAtivo({
        id,
        tipo: 'tarefa',
        titulo: tarefa.titulo,
        data: dataNotificacao.toISOString(),
        itemId: tarefa.id,
        deviceId: this.deviceId
      });

      return timerId;
    }


    _enviarNotificacaoEvento(evento, minutosAntes) {
      const tipos = {
        'prova': '📝 Prova',
        'trabalho': '📋 Trabalho',
        'aula': '🎓 Aula',
        'outro': '📌 Evento'
      };

      const tipo = tipos[evento.tipo] || '📌 Evento';
      
      if (this.permissao) {
        new Notification(`🔔 ${tipo}: ${evento.titulo}`, {
          body: `Começa em ${minutosAntes} minutos!\n${evento.data} ${evento.hora || ''}`,
          icon: '/icons/maskable_icon_x192.png',
          badge: '/icons/favicon-32x32.png',
          tag: `evento-${evento.id}`,
          requireInteraction: true
        });
      }
    }

    _enviarNotificacaoTarefa(tarefa, minutosAntes) {
      const prioridade = {
        'alta': '🔴 Alta',
        'media': '🟡 Média',
        'baixa': '🟢 Baixa'
      }[tarefa.prioridade] || '';

      if (this.permissao) {
        new Notification(`✅ Tarefa: ${tarefa.titulo}`, {
          body: `Vence em ${minutosAntes} minutos! ${prioridade}`,
          icon: '/icons/maskable_icon_x192.png',
          badge: '/icons/favicon-32x32.png',
          tag: `tarefa-${tarefa.id}`,
          requireInteraction: true
        });
      }
    }

    async _enviarPushParaOutrosDispositivos(dados) {
      if (!this.subscription) return;

      try {
        const token = await this._getToken();
        if (!token) return;

        await fetch('/api/push-enviar', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...dados,
            deviceIdRemetente: this.deviceId
          })
        });
      } catch (error) {
        console.error('Erro ao enviar push para outros dispositivos:', error);
      }
    }


    cancelar(id) {
      if (this.timers[id]) {
        clearTimeout(this.timers[id]);
        delete this.timers[id];
        this._removerAtivo(id);
        return true;
      }
      return false;
    }

    cancelarPorItemId(itemId, tipo = 'evento') {
      const id = `${tipo}-${itemId}-${this.deviceId}`;
      return this.cancelar(id);
    }

    reagendarTodas(eventos, tarefas) {
      Object.keys(this.timers).forEach(key => {
        clearTimeout(this.timers[key]);
      });
      this.timers = {};
      this.ativos = [];

      eventos?.forEach(evento => {
        if (evento.notificar && !evento.concluido) {
          this.agendarEvento(evento);
        }
      });

      tarefas?.forEach(tarefa => {
        if (tarefa.notificar && !tarefa.concluida && tarefa.prazo) {
          this.agendarTarefa(tarefa);
        }
      });
    }

    _salvarAtivo(ativo) {
      this.ativos = this.ativos.filter(a => a.id !== ativo.id);
      this.ativos.push(ativo);
      localStorage.setItem('uniagenda_notificacoes', JSON.stringify(this.ativos));
    }

    _removerAtivo(id) {
      this.ativos = this.ativos.filter(a => a.id !== id);
      localStorage.setItem('uniagenda_notificacoes', JSON.stringify(this.ativos));
    }

    _carregarAtivos() {
      const saved = localStorage.getItem('uniagenda_notificacoes');
      if (saved) {
        try {
          this.ativos = JSON.parse(saved);
        } catch (e) {
          console.error('Erro ao carregar notificações:', e);
        }
      }
    }

    _reagendarTodas() {
      if (window.DB) {
        this.reagendarTodas(window.DB.eventos, window.DB.tarefas);
      }
    }


    listarAtivos() {
      return this.ativos.filter(a => a.deviceId === this.deviceId);
    }

    listarTodosDispositivos() {
      return this.dispositivos;
    }

    getPermissao() {
      return this.permissao;
    }

    getDeviceId() {
      return this.deviceId;
    }
  }

  window.notificacao = new NotificacaoService();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.notificacao.init();
    });
  } else {
    window.notificacao.init();
  }
})();