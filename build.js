const fs = require('fs');
const path = require('path');

console.log('🔨 Iniciando build...');

// Função para ler arquivo
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`❌ Erro ao ler ${filePath}:`, err.message);
    return '';
  }
}

// Função para substituir placeholders
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

// Criar pasta dist se não existir
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'));
}

// Criar subpastas
if (!fs.existsSync(path.join(__dirname, 'dist/css'))) {
  fs.mkdirSync(path.join(__dirname, 'dist/css'), { recursive: true });
}
if (!fs.existsSync(path.join(__dirname, 'dist/js'))) {
  fs.mkdirSync(path.join(__dirname, 'dist/js'), { recursive: true });
}

// Carregar todos os componentes
console.log('📁 Carregando componentes...');

// Mapeamento explícito de todos os placeholders
const components = {
  // Componentes principais
  'head': readFile(path.join(__dirname, 'src/components/head.html')),
  'install-pwa': readFile(path.join(__dirname, 'src/components/install-pwa.html')),
  'loader': readFile(path.join(__dirname, 'src/components/loader.html')),
  'sidebar': readFile(path.join(__dirname, 'src/components/sidebar.html')),
  'header': readFile(path.join(__dirname, 'src/components/header.html')),
  'mobile-nav': readFile(path.join(__dirname, 'src/components/mobile-nav.html')),
  'floating-buttons': readFile(path.join(__dirname, 'src/components/floating-buttons.html')),
  
  // Modais
  'universal-modal': readFile(path.join(__dirname, 'src/components/modals/universal-modal.html')),
  'import-export-modal': readFile(path.join(__dirname, 'src/components/modals/import-export-modal.html')),
  
  // Seções
  'dashboard': readFile(path.join(__dirname, 'src/sections/dashboard.html')),
  'agenda': readFile(path.join(__dirname, 'src/sections/agenda.html')),
  'horarios': readFile(path.join(__dirname, 'src/sections/horarios.html')),
  'tarefas': readFile(path.join(__dirname, 'src/sections/tarefas.html')),
  'notas': readFile(path.join(__dirname, 'src/sections/notas.html')),
  'materias': readFile(path.join(__dirname, 'src/sections/materias.html'))
};

// Verificar se todos os componentes foram carregados
console.log('📋 Status dos componentes:');
Object.keys(components).forEach(key => {
  const status = components[key] ? components[key].length + ' caracteres' : '❌ VAZIO';
  console.log(`   - ${key}: ${status}`);
});

// Ler o template principal
const templatePath = path.join(__dirname, 'src/index.html');
console.log(`📄 Lendo template: ${templatePath}`);
const template = readFile(templatePath);

// Substituir placeholders
console.log('🔄 Processando placeholders...');
let finalHtml = replacePlaceholders(template, components);

// Salvar o arquivo final
const outputPath = path.join(__dirname, 'dist/index.html');
fs.writeFileSync(outputPath, finalHtml);
console.log(`✅ Build concluído! Arquivo gerado em ${outputPath}`);

// Copiar CSS para dist
const cssSource = path.join(__dirname, 'src/css/style.css');
const cssDest = path.join(__dirname, 'dist/css/style.css');
fs.copyFileSync(cssSource, cssDest);
console.log('✅ CSS copiado para dist/css/style.css');

// Copiar JS para dist
const jsSource = path.join(__dirname, 'src/js/app.js');
const jsDest = path.join(__dirname, 'dist/js/app.js');
fs.copyFileSync(jsSource, jsDest);
console.log('✅ JS copiado para dist/js/app.js');

// Listar arquivos gerados
console.log('📁 Arquivos em dist/:');
const distFiles = fs.readdirSync(path.join(__dirname, 'dist'));
distFiles.forEach(file => {
  const stats = fs.statSync(path.join(__dirname, 'dist', file));
  if (stats.isDirectory()) {
    console.log(`   📁 ${file}/`);
    const subFiles = fs.readdirSync(path.join(__dirname, 'dist', file));
    subFiles.forEach(sub => console.log(`      - ${sub}`));
  } else {
    console.log(`   - ${file}`);
  }
});