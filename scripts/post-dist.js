const path = require('path');
const fs = require('fs');

function findSetupArtifacts(distDir) {
  const entries = fs.readdirSync(distDir);
  const setups = entries.filter(name => name.endsWith('.exe') && name.includes('Setup'));
  return setups.map(name => ({
    exe: path.join(distDir, name),
    blockmap: path.join(distDir, `${name}.blockmap`),
    name,
  }));
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function moveFile(src, dest) {
  try {
    // Substitui se já existir
    try {
      await fs.promises.unlink(dest);
    } catch (e) {
      // ok se não existir
    }
    await ensureDir(path.dirname(dest));
    await fs.promises.rename(src, dest);
    console.log(`[post-dist] Movido: ${src} -> ${dest}`);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.warn(`[post-dist] Arquivo não encontrado (ok): ${src}`);
    } else {
      console.warn(`[post-dist] Não foi possível mover ${src}: ${e.message}`);
    }
  }
}

async function run() {
  const root = path.resolve(__dirname, '..');
  const distDir = path.join(root, 'dist');
  const pkg = require(path.join(root, 'package.json'));
  const buildVersion = (pkg.build && pkg.build.buildVersion) || pkg.buildVersion || null;
  const version = pkg.version || 'unknown';
  const displayVersion = buildVersion || version;
  const targetDir = path.join(distDir, 'setups', displayVersion);

  const artifacts = findSetupArtifacts(distDir);
  if (artifacts.length === 0) {
    console.warn('[post-dist] Nenhum setup .exe encontrado em dist.');
    return;
  }

  for (const art of artifacts) {
    const ext = path.extname(art.name);
    const destName = `Wasabi Viewer Setup ${displayVersion}${ext}`;
    const destExe = path.join(targetDir, destName);
    const destBlockmap = path.join(targetDir, `${destName}.blockmap`);
    await moveFile(art.exe, destExe);
    await moveFile(art.blockmap, destBlockmap);
  }

  console.log(`[post-dist] Organização concluída em: ${targetDir}`);
}

run();