const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
let pngToIco = require('png-to-ico');
pngToIco = pngToIco && pngToIco.default ? pngToIco.default : pngToIco;

async function main() {
  try {
    // Usa green_leaf_logo.png como fonte principal; fallback para imagens existentes
    const primaryPng = path.join(__dirname, '..', 'green_leaf_logo.png');
    const altPng1 = path.join(__dirname, '..', 'assets', 'green_leaf_logo.png');
    const fallbackPng = path.join(__dirname, '..', 'assets', 'screenshots', 'wasabi-viewer.png');
    let pngPath = [primaryPng, altPng1, fallbackPng].find(p => fs.existsSync(p)) || primaryPng;
    const sizes = [16, 32, 48, 64, 128, 256];
    const icoPath = path.join(__dirname, '..', 'assets', 'icone_green_leaf.ico');
    const rootIcoPath = path.join(__dirname, '..', 'icone_green_leaf.ico');
    // Escolhe fonte existente
    if (!fs.existsSync(pngPath)) {
      throw new Error(`Nenhuma fonte PNG encontrada. Proveja ${primaryPng} ou ${altPng1}.`);
    }
    // Pré-processa múltiplos tamanhos para um .ico robusto
    let buffers;
    try {
      buffers = await Promise.all(
        sizes.map(sz =>
          sharp(pngPath)
            .resize(sz, sz, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer()
        )
      );
    } catch (e) {
      if (pngPath !== altPng1 && fs.existsSync(altPng1)) {
        pngPath = altPng1;
        buffers = await Promise.all(
          sizes.map(sz =>
            sharp(pngPath)
              .resize(sz, sz, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .png()
              .toBuffer()
          )
        );
      } else {
        throw e;
      }
    }

    const buf = await pngToIco(buffers);
    fs.writeFileSync(icoPath, buf);
    fs.writeFileSync(rootIcoPath, buf);
    console.log(`✔ Ícone gerado (preferido): ${icoPath}`);
    console.log(`✔ Ícone preferido copiado para raiz: ${rootIcoPath}`);

    // Garantir cópia do icone_green_leaf.ico para assets (preferido)
    try {
      const preferredIcoRoot = rootIcoPath;
      const preferredIcoAssets = icoPath;
      if (fs.existsSync(preferredIcoRoot)) {
        fs.copyFileSync(preferredIcoRoot, preferredIcoAssets);
        console.log(`✔ Ícone preferido copiado para assets: ${preferredIcoAssets}`);
      }
    } catch (copyErr) {
      console.warn('Aviso: falha ao copiar icone_green_leaf.ico para assets:', copyErr.message);
    }
  } catch (err) {
    console.error('Falha ao gerar .ico:', err.message);
    process.exit(1);
  }
}

main();