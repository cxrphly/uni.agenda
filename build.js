const fs = require('fs');
const path = require('path');

console.log('🔨 Iniciando build do UniAgenda...');

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`❌ Erro ao ler ${filePath}:`, err.message);
    return '';
  }
}

function injectEnvVars(content) {
  const supabaseUrl = 'https://dkjymeggfmeueixupzmo.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRranltZWdnZm1ldWVpeHVwem1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTc4NjUsImV4cCI6MjA4ODQ3Mzg2NX0.nHdGsI_E-4HT8ZispVTwfx0ZDjYFp4-GgmeIAbVIdMA';

  const envScript = `
<script>
  window.ENV = {
    SUPABASE_URL: '${supabaseUrl}',
    SUPABASE_ANON_KEY: '${supabaseKey}'
  };
</script>
`;
  return content.replace('</head>', envScript + '\n</head>');
}

function replacePlaceholders(content, components) {
  return content.replace(/\{\{([\w-]+)\}\}/g, (match, componentName) => {
    if (components[componentName]) {
      console.log(`✅ Substituindo {{${componentName}}}`);
      return components[componentName];
    }
    console.warn(`⚠️ Placeholder não encontrado: {{${componentName}}}`);
    return `<!-- {{${componentName}}} NÃO ENCONTRADO -->`;
  });
}

// Criar pastas
const dirs = ['dist', 'dist/css', 'dist/js', 'dist/js/services'];
dirs.forEach(dir => {
  if (!fs.existsSync(path.join(__dirname, dir))) {
    fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
    console.log(`   Criada: ${dir}`);
  }
});

// Carregar componentes
console.log('📁 Carregando componentes HTML...');
const components = {
  'head': readFile(path.join(__dirname, 'src/components/head.html')),
  'install-pwa': readFile(path.join(__dirname, 'src/components/install-pwa.html')),
  'loader': readFile(path.join(__dirname, 'src/components/loader.html')),
  'sidebar': readFile(path.join(__dirname, 'src/components/sidebar.html')),
  'header': readFile(path.join(__dirname, 'src/components/header.html')),
  'mobile-nav': readFile(path.join(__dirname, 'src/components/mobile-nav.html')),
  'floating-buttons': readFile(path.join(__dirname, 'src/components/floating-buttons.html')),
  'universal-modal': readFile(path.join(__dirname, 'src/components/modals/universal-modal.html')),
  'import-export-modal': readFile(path.join(__dirname, 'src/components/modals/import-export-modal.html')),
  'login-modal': readFile(path.join(__dirname, 'src/components/auth/login-modal.html')),
  'sync-indicator': readFile(path.join(__dirname, 'src/components/sync-indicator.html')),
  'dashboard': readFile(path.join(__dirname, 'src/sections/dashboard.html')),
  'agenda': readFile(path.join(__dirname, 'src/sections/agenda.html')),
  'horarios': readFile(path.join(__dirname, 'src/sections/horarios.html')),
  'tarefas': readFile(path.join(__dirname, 'src/sections/tarefas.html')),
  'notas': readFile(path.join(__dirname, 'src/sections/notas.html')),
  'materias': readFile(path.join(__dirname, 'src/sections/materias.html'))
};

// Processar index.html
console.log('\n📄 Processando index.html...');
const template = readFile(path.join(__dirname, 'src/index.html'));
let indexHtml = replacePlaceholders(template, components);
indexHtml = injectEnvVars(indexHtml);
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), indexHtml);
console.log('✅ index.html gerado');

// Processar login.html
console.log('\n📄 Processando login.html...');
const loginSource = path.join(__dirname, 'src/login.html');
if (fs.existsSync(loginSource)) {
  let loginHtml = readFile(loginSource);
  loginHtml = injectEnvVars(loginHtml);
  fs.writeFileSync(path.join(__dirname, 'dist/login.html'), loginHtml);
  console.log('✅ login.html gerado');
}

// Copiar CSS
console.log('\n📁 Copiando CSS...');
fs.copyFileSync(
  path.join(__dirname, 'src/css/style.css'),
  path.join(__dirname, 'dist/css/style.css')
);
console.log('✅ CSS copiado');

// Copiar JS
console.log('\n📁 Copiando JavaScript...');
const jsFiles = [
  'src/js/config.js',
  'src/js/app.js',
  'src/js/login.js',
  'src/js/services/auth.js',
  'src/js/services/data.js'
];

jsFiles.forEach(file => {
  const source = path.join(__dirname, file);
  const dest = path.join(__dirname, 'dist/js', file.replace('src/js/', ''));
  
  if (fs.existsSync(source)) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(source, dest);
    console.log(`✅ ${file} copiado`);
  }
});

console.log('\n🎉 Build concluído com sucesso!');