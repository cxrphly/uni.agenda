(function() {
  class NotificacaoUI {
    constructor() {
      this.btn = document.getElementById('notificacao-btn');
      this.badge = document.getElementById('notificacao-badge');
      this.init();
    }

    init() {
      if (!this.btn) return;

      this.atualizarBadge();
      this.atualizarCor();

      setInterval(() => this.atualizarBadge(), 60000);
    }

    atualizarBadge() {
      if (!window.notificacao || !this.badge) return;

      const ativos = window.notificacao.listarAtivos?.() || [];
      
      if (ativos.length > 0 && window.notificacao.permissao) {
        this.badge.textContent = ativos.length > 9 ? '9+' : ativos.length;
        this.badge.classList.remove('hidden');
      } else {
        this.badge.classList.add('hidden');
      }
    }

    atualizarCor() {
      if (!window.notificacao || !this.btn) return;

      if (window.notificacao.permissao) {
        this.btn.classList.remove('text-gray-500');
        this.btn.classList.add('text-green-600');
      } else {
        this.btn.classList.remove('text-green-600');
        this.btn.classList.add('text-gray-500');
      }
    }

    mostrarStatus() {
      if (!window.notificacao) return;

      const ativos = window.notificacao.listarAtivos?.() || [];
      
      if (ativos.length === 0) {
        if (window.notificacao.permissao) {
          alert('📅 Nenhuma notificação agendada');
        } else {
          alert('🔔 Notificações desativadas. Clique no sino para ativar.');
        }
      } else {
        const mensagem = ativos.map(a => {
          const data = new Date(a.data);
          const agora = new Date();
          const diff = Math.round((data - agora) / 60000);
          return `• ${a.titulo} (${diff < 0 ? 'agora' : `em ${diff} min`})`;
        }).join('\n');
        
        if (confirm(`📋 Notificações agendadas:\n\n${mensagem}\n\nCancelar todas?`)) {
          ativos.forEach(a => window.notificacao.cancelar(a.id));
          this.atualizarBadge();
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.notificacaoUI = new NotificacaoUI();
    });
  } else {
    window.notificacaoUI = new NotificacaoUI();
  }
})();