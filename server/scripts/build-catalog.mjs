// Construye server/data/catalog.json a partir del repositorio openGym clonado.
// Uso: node scripts/build-catalog.mjs <ruta-al-clon-de-opengym>
// Fusiona:
//  - frontend/src/lib/exercises-data.js  (EXDB: id, n, bp, eq, tg, mg, sm, img, gif, cat, fv)
//  - catalogue/exercises/*.json           (descripción + instrucciones por ejercicio)
//  - catalogue/i18n/es.json              (nombre en español, si existe)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = process.argv[2];
if (!repoRoot || !fs.existsSync(repoRoot)) {
  console.error('Pasa la ruta del clon de openGym como argumento.');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });

// 1) EXDB: catálogo base (ESM con JSON inline)
const dataModule = path.join(repoRoot, 'frontend', 'src', 'lib', 'exercises-data.js');
const { EXDB } = await import('file://' + dataModule.replace(/\\/g, '/'));
console.log(`EXDB: ${EXDB.length} ejercicios`);

// 2) Nombres en español
const esPath = path.join(repoRoot, 'catalogue', 'i18n', 'es.json');
const esNames = fs.existsSync(esPath) ? JSON.parse(fs.readFileSync(esPath, 'utf8')) : {};
console.log(`es.json: ${Object.keys(esNames).length} nombres`);

// 3) Descripciones e instrucciones
const detailDir = path.join(repoRoot, 'catalogue', 'exercises');
const details = {};
if (fs.existsSync(detailDir)) {
  for (const file of fs.readdirSync(detailDir)) {
    if (!file.endsWith('.json')) continue;
    const id = file.replace('.json', '');
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(detailDir, file), 'utf8'));
      if (raw.description || (raw.instructions && raw.instructions.length)) {
        details[id] = {
          ...(raw.description ? { description: raw.description } : {}),
          ...(raw.instructions && raw.instructions.length ? { instructions: raw.instructions } : {}),
        };
      }
    } catch {
      // archivo con JSON inválido: se ignora
    }
  }
}
console.log(`detalles: ${Object.keys(details).length} ejercicios`);

// 4) Fusión final
const catalog = EXDB.map((ex) => {
  const detail = details[ex.id] || {};
  const es = esNames[ex.id];
  return {
    id: ex.id,
    name: ex.n,
    ...(es && es.name ? { nameEs: es.name } : {}),
    bodyPart: ex.bp,
    equipment: ex.eq,
    target: ex.tg,
    muscleGroup: ex.mg,
    secondaryMuscles: ex.sm || [],
    category: ex.cat,
    img: ex.img || `${ex.id}.webp`,
    gif: ex.gif || `${ex.id}.mp4`,
    ...(ex.fv ? { femaleVariant: ex.fv } : {}),
    ...(ex.hd ? { hd: true } : {}),
    ...(detail.description ? { description: detail.description } : {}),
    ...(detail.instructions ? { instructions: detail.instructions } : {}),
  };
});

const outPath = path.join(outDir, 'catalog.json');
fs.writeFileSync(outPath, JSON.stringify(catalog));
console.log(`Escrito ${outPath}: ${catalog.length} ejercicios, ${(
  fs.statSync(outPath).size / 1024 / 1024
).toFixed(1)} MB`);
