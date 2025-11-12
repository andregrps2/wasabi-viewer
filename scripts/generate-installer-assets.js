const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { Buffer } = require('buffer');

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
}

async function createImage({ width, height, background, logoPath, logoWidth, logoHeight, outPath, text, textColor = '#ffffff', textSize, layout = 'sidebar' }) {
  await ensureDir(outPath);

  const base = sharp({
    create: {
      width,
      height,
      channels: 3,
      background,
    },
  });

  const logo = await sharp(logoPath)
    .resize(logoWidth || null, logoHeight || null, { fit: 'inside' })
    .toBuffer();

  // Calcula posição do logo conforme layout
  let logoLeft = Math.floor((width - (logoWidth || width)) / 2);
  let logoTop = Math.floor((height - (logoHeight || height)) / 2);
  if (layout === 'sidebar') {
    // Centraliza no topo para a barra lateral (padrão inicial)
    logoLeft = Math.floor((width - (logoWidth || width)) / 2);
    logoTop = 28;
  } else if (layout === 'header') {
    // Ícone à esquerda no header (padrão inicial)
    logoLeft = 8;
    logoTop = Math.floor((height - (logoHeight || 40)) / 2);
  }

  // Sem acentos/overlays: usar somente cor de fundo padrão inicial

  const svgText = text
    ? Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>
        <style>
          .title { font-family:Segoe UI, Arial; font-weight:600; fill:${textColor}; }
          .subtitle { font-family:Segoe UI, Arial; font-weight:500; fill:${textColor}; opacity:0.85; }
        </style>
        ${layout === 'sidebar'
          ? `<text x='${Math.floor(width/2)}' y='${Math.floor(height*0.68)}' text-anchor='middle' class='title' font-size='${textSize || 22}'>${text}</text>`
          : `<text x='16' y='${Math.floor(height*0.68)}' class='title' font-size='${textSize || 20}'>${text}</text>`}
      </svg>`)
    : null;

  const composites = [
    { input: logo, left: logoLeft, top: logoTop },
  ];
  if (svgText) composites.push({ input: svgText });

  const pipeline = base.composite(composites);
  const ext = path.extname(outPath).toLowerCase();
  if (ext === '.bmp') {
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const result = await writeBmpFromRaw(data, info, outPath);
    return result;
  } else {
    const result = await pipeline.png().toFile(outPath);
    return result;
  }
}

async function writeBmpFromRaw(data, info, outPath) {
  const width = info.width;
  const height = info.height;
  const channels = info.channels; // expect 3 (RGB)
  const rowSize = Math.floor((24 * width + 31) / 32) * 4; // bytes per row
  const pixelArraySize = rowSize * height;
  const fileSize = 14 + 40 + pixelArraySize;

  const header = Buffer.alloc(14);
  header.writeUInt16LE(0x4D42, 0); // 'BM'
  header.writeUInt32LE(fileSize, 2);
  header.writeUInt32LE(0, 6);
  header.writeUInt32LE(14 + 40, 10); // pixel data offset

  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0); // DIB header size
  dib.writeInt32LE(width, 4);
  dib.writeInt32LE(height, 8);
  dib.writeUInt16LE(1, 12); // planes
  dib.writeUInt16LE(24, 14); // bpp
  dib.writeUInt32LE(0, 16); // BI_RGB compression
  dib.writeUInt32LE(pixelArraySize, 20);
  dib.writeInt32LE(2835, 24); // X pixels per meter (72 DPI)
  dib.writeInt32LE(2835, 28); // Y pixels per meter
  dib.writeUInt32LE(0, 32); // colors used
  dib.writeUInt32LE(0, 36); // important colors

  const pixels = Buffer.alloc(pixelArraySize);
  const bytesPerPixel = channels; // 3
  const padding = rowSize - width * 3;
  for (let y = 0; y < height; y++) {
    const srcRowStart = y * width * bytesPerPixel;
    const dstRowStart = (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const si = srcRowStart + x * bytesPerPixel;
      const di = dstRowStart + x * 3;
      const r = data[si];
      const g = data[si + 1];
      const b = data[si + 2];
      pixels[di] = b;
      pixels[di + 1] = g;
      pixels[di + 2] = r;
    }
    // padding is already zero by Buffer.alloc
    if (padding > 0) {
      // nothing to do; zeros already
    }
  }

  await fs.promises.writeFile(outPath, Buffer.concat([header, dib, pixels]));
  return { outPath };
}

async function run() {
  try {
    const root = path.resolve(__dirname, '..');
    // Seleciona a melhor logo disponível para gerar assets do instalador
    const candidateLogos = [
      path.join(root, 'green_leaf_logo.png'),
      path.join(root, 'logo_wasabi.png'),
      path.join(root, 'assets', 'green_leaf_logo.png'),
      path.join(root, 'assets', 'logo_wasabi.png')
    ];
    let logoPath = candidateLogos.find(p => fs.existsSync(p));
    if (!logoPath) {
      console.warn('[installer-assets] Nenhuma logo encontrada para gerar imagens do NSIS. Pulando geração.');
      return;
    }
    const assetsDir = path.join(root, 'assets');

    // Sidebar (NSIS): typically 164x314 for the installer/uninstaller panel
    const sidebarWidth = 164;
    const sidebarHeight = 314;

    // Header (NSIS): typically around 150x57
    const headerWidth = 150;
    const headerHeight = 57;

    const sidebarOutPng = path.join(assetsDir, 'nsis-installer-sidebar.png');
    const uninstallerSidebarOutPng = path.join(assetsDir, 'nsis-uninstaller-sidebar.png');
    const headerOutPng = path.join(assetsDir, 'nsis-installer-header.png');
    const sidebarOutBmp = path.join(assetsDir, 'nsis-installer-sidebar.bmp');
    const uninstallerSidebarOutBmp = path.join(assetsDir, 'nsis-uninstaller-sidebar.bmp');
    const headerOutBmp = path.join(assetsDir, 'nsis-installer-header.bmp');

    // Padrão inicial (fundo verde)
    const bgColor = '#1b5e20';

    console.log('[installer-assets] Generating NSIS sidebar images...');
    await createImage({
      width: sidebarWidth,
      height: sidebarHeight,
      background: bgColor,
      logoPath,
      logoWidth: 128,
      logoHeight: 128,
      outPath: sidebarOutPng,
      text: 'Wasabi Viewer',
      textColor: '#ffffff',
      textSize: 20,
      layout: 'sidebar',
    });
    await createImage({
      width: sidebarWidth,
      height: sidebarHeight,
      background: bgColor,
      logoPath,
      logoWidth: 128,
      logoHeight: 128,
      outPath: sidebarOutBmp,
      text: 'Wasabi Viewer',
      textColor: '#ffffff',
      textSize: 20,
      layout: 'sidebar',
    });

    await createImage({
      width: sidebarWidth,
      height: sidebarHeight,
      background: bgColor,
      logoPath,
      logoWidth: 128,
      logoHeight: 128,
      outPath: uninstallerSidebarOutPng,
      text: 'Wasabi Viewer',
      textColor: '#ffffff',
      textSize: 20,
      layout: 'sidebar',
    });
    await createImage({
      width: sidebarWidth,
      height: sidebarHeight,
      background: bgColor,
      logoPath,
      logoWidth: 128,
      logoHeight: 128,
      outPath: uninstallerSidebarOutBmp,
      text: 'Wasabi Viewer',
      textColor: '#ffffff',
      textSize: 20,
      layout: 'sidebar',
    });

    console.log('[installer-assets] Generating NSIS header image...');
    await createImage({
      width: headerWidth,
      height: headerHeight,
      background: bgColor,
      logoPath,
      logoWidth: 40,
      logoHeight: 40,
      outPath: headerOutPng,
      text: null,
      layout: 'header',
    });
    await createImage({
      width: headerWidth,
      height: headerHeight,
      background: bgColor,
      logoPath,
      logoWidth: 40,
      logoHeight: 40,
      outPath: headerOutBmp,
      text: null,
      layout: 'header',
    });

    console.log('[installer-assets] Done.');

    // Garante cópia da logo antiga para assets (compatibilidade)
    const assetsLogoPath = path.join(assetsDir, 'logo_wasabi.png');
    try {
      if (!fs.existsSync(assetsLogoPath)) {
        await fs.promises.copyFile(logoPath, assetsLogoPath);
        console.log(`[installer-assets] Copiada logo para assets: ${assetsLogoPath}`);
      }
    } catch (e) {
      console.warn('[installer-assets] Não foi possível copiar logo para assets:', e.message);
    }

    // Copiar green_leaf_logo.png para assets para uso no renderer pós-instalação
    const greenLogoSrc = path.join(root, 'green_leaf_logo.png');
    const greenLogoDest = path.join(assetsDir, 'green_leaf_logo.png');
    try {
      if (fs.existsSync(greenLogoSrc)) {
        await fs.promises.copyFile(greenLogoSrc, greenLogoDest);
        console.log(`[installer-assets] Copiada green logo para assets: ${greenLogoDest}`);
      } else {
        console.warn('[installer-assets] Arquivo green_leaf_logo.png não encontrado na raiz.');
      }
    } catch (e) {
      console.warn('[installer-assets] Não foi possível copiar green_leaf_logo.png para assets:', e.message);
    }
  } catch (err) {
    console.error('[installer-assets] Error generating installer assets:', err);
    process.exitCode = 1;
  }
}

run();