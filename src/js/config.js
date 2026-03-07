// config.js - Configurações centralizadas
(function() {
  window.ENV = window.ENV || {};
  
  const defaultEnv = {
    SUPABASE_URL: 'https://dkjymeggfmeueixupzmo.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRranltZWdnZm1ldWVpeHVwem1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTc4NjUsImV4cCI6MjA4ODQ3Mzg2NX0.nHdGsI_E-4HT8ZispVTwfx0ZDjYFp4-GgmeIAbVIdMA'
  };
  
  window.appConfig = {
    supabase: {
      url: window.ENV.SUPABASE_URL || defaultEnv.SUPABASE_URL,
      anonKey: window.ENV.SUPABASE_ANON_KEY || defaultEnv.SUPABASE_ANON_KEY
    }
  };
  
  console.log('✅ Configurações carregadas', window.appConfig);
})();