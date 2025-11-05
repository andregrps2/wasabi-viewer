const fs = require('fs');
const path = require('path');

async function rimraf(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      const full = path.join(target, entry);
      await rimraf(full);
    }
    try {
      fs.rmdirSync(target);
      console.log(`[clean-dist] Removida pasta: ${target}`);
    } catch (e) {
      console.warn(`[clean-dist] Não foi possível remover pasta: ${target} - ${e.message}`);
    }
  } else {
    try {
      fs.unlinkSync(target);
      console.log(`[clean-dist] Removido arquivo: ${target}`);
    } catch (e) {
      console.warn(`[clean-dist] Não foi possível remover arquivo: ${target} - ${e.message}`);
    }
  }
}

async function run() {
  const root = path.resolve(__dirname, '..');
  const distDir = path.join(root, 'dist');
  console.log(`[clean-dist] Limpando: ${distDir}`);
  await rimraf(distDir);
}

run();