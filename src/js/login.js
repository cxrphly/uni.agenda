(function() {
  console.log('📦 login.js carregado');
  
  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(async () => {
    console.log('📱 Inicializando página de login');
    
    if (window.auth) {
      console.log('🔐 Auth disponível, inicializando...');
      await window.auth.init();
      
      const isLoggedIn = await window.auth.checkAuthAndRedirect();
      if (isLoggedIn) return;
    }
    
    setupEventListeners();
  });

  function setupEventListeners() {
    console.log('🔧 Configurando event listeners');
    
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('text-indigo-600', 'border-indigo-600');
        tabRegister.classList.remove('text-indigo-600', 'border-indigo-600');
        if (loginForm) loginForm.classList.remove('hidden');
        if (registerForm) registerForm.classList.add('hidden');
        hideError();
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('text-indigo-600', 'border-indigo-600');
        tabLogin.classList.remove('text-indigo-600', 'border-indigo-600');
        if (registerForm) registerForm.classList.remove('hidden');
        if (loginForm) loginForm.classList.add('hidden');
        hideError();
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
          showError('Preencha todos os campos');
          return;
        }

        const result = await window.auth?.loginWithEmail(email, password);
        
        if (result?.success) {
          window.location.href = '/';
        } else {
          showError(result?.error || 'Erro ao fazer login');
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;

        if (!name || !email || !password || !confirm) {
          showError('Preencha todos os campos');
          return;
        }

        if (password !== confirm) {
          showError('As senhas não conferem');
          return;
        }

        if (password.length < 8) {
          showError('A senha deve ter pelo menos 8 caracteres');
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showError('Email inválido');
          return;
        }

        const result = await window.auth?.registerWithEmail(email, password, name);
        
        if (result?.success) {
          showToast('✅ Cadastro realizado! Faça login.');
          
          if (tabLogin) tabLogin.click();
          
          document.getElementById('register-name').value = '';
          document.getElementById('register-email').value = '';
          document.getElementById('register-password').value = '';
          document.getElementById('register-confirm').value = '';
          
          document.getElementById('login-email').value = email;
          document.getElementById('login-password').value = '';
        } else {
          showError(result?.error || 'Erro ao cadastrar');
        }
      });
    }
  }

  function showError(message) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    } else {
      alert(message);
    }
  }

  function hideError() {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) {
      alert(message);
      return;
    }
    
    const toast = document.createElement('div');
    toast.className = 'bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg mb-2';
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
  }
})();