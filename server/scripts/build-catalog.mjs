// Builds server/data/catalog.json from a cloned openGym repository.
// Usage: node scripts/build-catalog.mjs <path-to-opengym-clone>
// Merges:
//  - frontend/src/lib/exercises-data.js  (EXDB: id, n, bp, eq, tg, mg, sm, img, gif, cat, fv)
//  - catalogue/exercises/*.json           (description + instructions per exercise)
//  - catalogue/i18n/es.json              (Spanish name, if present)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = process.argv[2];
if (!repoRoot || !fs.existsSync(repoRoot)) {
  console.error('Pass the path to the openGym clone as an argument.');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'data');
fs.mkdirSync(outDir, { recursive: true });

// 1) EXDB: base catalog (ESM with inline JSON)
const dataModule = path.join(repoRoot, 'frontend', 'src', 'lib', 'exercises-data.js');
const { EXDB } = await import('file://' + dataModule.replace(/\\/g, '/'));
console.log(`EXDB: ${EXDB.length} exercises`);

// 2) Spanish names
const esPath = path.join(repoRoot, 'catalogue', 'i18n', 'es.json');
const esNames = fs.existsSync(esPath) ? JSON.parse(fs.readFileSync(esPath, 'utf8')) : {};
console.log(`es.json: ${Object.keys(esNames).length} names`);

// 3) Descriptions and instructions
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
      // file with invalid JSON: ignored
    }
  }
}
console.log(`details: ${Object.keys(details).length} exercises`);

// 4) Final merge
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
console.log(`Wrote ${outPath}: ${catalog.length} exercises, ${(
  fs.statSync(outPath).size / 1024 / 1024
).toFixed(1)} MB`);
