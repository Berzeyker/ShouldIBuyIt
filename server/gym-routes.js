// Integrated openGym routes: exercise catalog, routines, weekly plan,
// training sessions, body weight and stats. Everything persists in Neon.
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { pool } = require('./db');

const router = express.Router();

const CATALOG_FILE = path.join(__dirname, 'data', 'catalog.json');
const DAY_NAMES = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' };
const DAY_SHORT = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

async function ensureGymSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_exercises (
      id VARCHAR(8) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      name_es VARCHAR(200),
      body_part VARCHAR(60) NOT NULL,
      equipment VARCHAR(80) NOT NULL,
      target VARCHAR(80) NOT NULL,
      muscle_group VARCHAR(80) NOT NULL,
      secondary_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
      category VARCHAR(40) NOT NULL,
      img VARCHAR(24),
      gif VARCHAR(24),
      female_variant VARCHAR(8),
      description TEXT,
      instructions JSONB
    );

    CREATE TABLE IF NOT EXISTS user_routines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      emoji VARCHAR(8) NOT NULL DEFAULT '💪',
      exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_week (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 7),
      routine_id UUID NOT NULL REFERENCES user_routines(id) ON DELETE CASCADE,
      position INT NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day, routine_id)
    );

    CREATE TABLE IF NOT EXISTS user_workouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      routine_id UUID,
      entries JSONB NOT NULL DEFAULT '[]'::jsonb,
      state VARCHAR(16) NOT NULL DEFAULT 'active',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      duration_sec INT,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS user_bodyweight (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      weighed_on DATE NOT NULL,
      weight NUMERIC(6,2) NOT NULL,
      UNIQUE (user_id, weighed_on)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      unit VARCHAR(4) NOT NULL DEFAULT 'kg',
      lang VARCHAR(8) NOT NULL DEFAULT 'es',
      rest_sec INT NOT NULL DEFAULT 90,
      week_start SMALLINT NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS user_workouts_user_state_idx ON user_workouts (user_id, state, started_at DESC);
  `);
}

let catalogSeeded = false;
async function seedCatalogOnce() {
  if (catalogSeeded) return;
  const count = await pool.query('SELECT COUNT(*)::int AS n FROM catalog_exercises');
  if (count.rows[0].n > 0) {
    catalogSeeded = true;
    return;
  }
  if (!fs.existsSync(CATALOG_FILE)) {
    console.warn('catalog.json is missing: run node scripts/build-catalog.mjs <opengym-clone>');
    return;
  }
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(8412001)');
    const recheck = await client.query('SELECT COUNT(*)::int AS n FROM catalog_exercises');
    if (recheck.rows[0].n === 0) {
      const BATCH = 400;
      for (let i = 0; i < catalog.length; i += BATCH) {
        const batch = catalog.slice(i, i + BATCH);
        const values = [];
        const params = [];
        batch.forEach((ex, j) => {
          const base = j * 14;
          values.push(
            `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},` +
            `$${base + 8}::jsonb,$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14}::jsonb)`
          );
          params.push(
            ex.id, ex.name, ex.nameEs ?? null, ex.bodyPart, ex.equipment, ex.target, ex.muscleGroup,
            JSON.stringify(ex.secondaryMuscles || []), ex.category, ex.img ?? null, ex.gif ?? null,
            ex.femaleVariant ?? null, ex.description ?? null, JSON.stringify(ex.instructions ?? null)
          );
        });
        await client.query(
          `INSERT INTO catalog_exercises (id, name, name_es, body_part, equipment, target, muscle_group,
             secondary_muscles, category, img, gif, female_variant, description, instructions)
           VALUES ${values.join(',')}
           ON CONFLICT (id) DO NOTHING`,
          params
        );
      }
      console.log(`Catalog seeded: ${catalog.length} exercises`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  catalogSeeded = true;
}

async function gymReady() {
  await ensureGymSchema();
  await seedCatalogOnce();
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

const CATALOG_SELECT = `
  SELECT id, name, name_es AS "nameEs", body_part AS "bodyPart", equipment, target,
         muscle_group AS "muscleGroup", secondary_muscles AS "secondaryMuscles", category,
         img, gif, female_variant AS "femaleVariant", description, instructions
  FROM catalog_exercises`;

function serializeCatalogRow(row) {
  return {
    id: row.id,
    name: row.nameEs || row.name,
    originalName: row.name,
    bodyPart: row.bodyPart,
    equipment: row.equipment,
    target: row.target,
    muscleGroup: row.muscleGroup,
    secondaryMuscles: row.secondaryMuscles || [],
    category: row.category,
    img: row.img,
    gif: row.gif,
    femaleVariant: row.femaleVariant,
    description: row.description,
    instructions: row.instructions,
  };
}

function serializeRoutine(row) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    exercises: row.exercises || [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeWorkout(row) {
  return {
    id: row.id,
    name: row.name,
    routineId: row.routineId,
    entries: row.entries || [],
    state: row.state,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationSec: row.durationSec,
    notes: row.notes,
  };
}

const WORKOUT_SELECT = `
  SELECT id, name, routine_id AS "routineId", entries, state, started_at AS "startedAt",
         finished_at AS "finishedAt", duration_sec AS "durationSec", notes
  FROM user_workouts`;

function sanitizeRoutineExercises(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((ex) => ex && typeof ex.id === 'string' && ex.id.trim())
    .slice(0, 60)
    .map((ex) => ({
      id: String(ex.id).trim(),
      name: typeof ex.name === 'string' ? ex.name.slice(0, 200) : '',
      sets: Math.max(1, Math.min(20, Number(ex.sets) || 3)),
      reps: Math.max(1, Math.min(100, Number(ex.reps) || 10)),
      weight: Math.max(0, Number(ex.weight) || 0),
      restSec: Math.max(0, Math.min(1800, Number(ex.restSec) || 0)),
      ...(typeof ex.note === 'string' && ex.note ? { note: ex.note.slice(0, 500) } : {}),
    }));
}

function sanitizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 60).map((en) => {
    const cfg = en && typeof en.cfg === 'object' && en.cfg !== null ? en.cfg : {};
    const rows = Array.isArray(en?.rows) ? en.rows : [];
    return {
      exId: String(en?.exId ?? '').slice(0, 40),
      name: String(en?.name ?? '').slice(0, 200),
      cfg: {
        sets: Math.max(1, Math.min(20, Number(cfg.sets) || 3)),
        reps: Math.max(1, Math.min(100, Number(cfg.reps) || 10)),
        weight: Number(cfg.weight) || 0,
        restSec: Math.max(0, Math.min(1800, Number(cfg.restSec) || 0)),
        unit: cfg.unit === 'lb' ? 'lb' : 'kg',
        mode: ['reps', 'time', 'cardio'].includes(cfg.mode) ? cfg.mode : 'reps',
      },
      rows: rows.slice(0, 100).map((r) => ({
        w: Number(r?.w) || 0,
        r: Number(r?.r) || 0,
        ts: Number(r?.ts) || 0,
        phase: r?.phase === 'warmup' ? 'warmup' : 'work',
        ...(r?.failure === true ? { failure: true } : {}),
      })),
      ...(typeof en?.note === 'string' && en.note ? { note: en.note.slice(0, 500) } : {}),
    };
  }).filter((en) => en.exId);
}

// ---------------------------------------------------------------------------
// Catalog (public: reference data)
// ---------------------------------------------------------------------------

router.get('/catalog/meta', async (req, res) => {
  try {
    await gymReady();
    const [parts, eqs, cats, count] = await Promise.all([
      pool.query('SELECT DISTINCT body_part AS v FROM catalog_exercises ORDER BY v'),
      pool.query('SELECT DISTINCT equipment AS v FROM catalog_exercises ORDER BY v'),
      pool.query('SELECT DISTINCT category AS v FROM catalog_exercises ORDER BY v'),
      pool.query('SELECT COUNT(*)::int AS n FROM catalog_exercises'),
    ]);
    res.json({
      count: count.rows[0].n,
      bodyParts: parts.rows.map((r) => r.v),
      equipment: eqs.rows.map((r) => r.v),
      categories: cats.rows.map((r) => r.v),
      dayNames: DAY_NAMES,
      dayShort: DAY_SHORT,
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the catalog.', error: error.message });
  }
});

router.get('/catalog/search', async (req, res) => {
  try {
    await gymReady();
    const q = String(req.query.q || '').trim();
    const bp = String(req.query.bp || '').trim();
    const eq = String(req.query.eq || '').trim();
    const cat = String(req.query.cat || '').trim();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const where = [];
    const params = [];
    if (q) {
      // Word search: every term must appear (like openGym).
      const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
      for (const term of terms) {
        params.push(`%${term}%`);
        const i = params.length;
        where.push(`(name ILIKE $${i} OR name_es ILIKE $${i} OR target ILIKE $${i} OR muscle_group ILIKE $${i})`);
      }
    }
    if (bp) { params.push(bp); where.push(`body_part = $${params.length}`); }
    if (eq) { params.push(eq); where.push(`equipment = $${params.length}`); }
    if (cat) { params.push(cat); where.push(`category = $${params.length}`); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM catalog_exercises ${whereSql}`, params);
    const rows = await pool.query(
      `${CATALOG_SELECT} ${whereSql} ORDER BY name LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ total: total.rows[0].n, exercises: rows.rows.map(serializeCatalogRow) });
  } catch (error) {
    res.status(500).json({ message: 'Error searching exercises.', error: error.message });
  }
});

router.get('/catalog/bulk', async (req, res) => {
  try {
    await gymReady();
    const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 120);
    if (!ids.length) return res.json({ exercises: {} });
    const rows = await pool.query(`${CATALOG_SELECT} WHERE id = ANY($1::varchar[])`, [ids]);
    const map = {};
    rows.rows.forEach((r) => { map[r.id] = serializeCatalogRow(r); });
    res.json({ exercises: map });
  } catch (error) {
    res.status(500).json({ message: 'Error loading exercises.', error: error.message });
  }
});

router.get('/catalog/:id', async (req, res) => {
  try {
    await gymReady();
    const rows = await pool.query(`${CATALOG_SELECT} WHERE id = $1`, [req.params.id]);
    if (!rows.rows.length) return res.status(404).json({ message: 'Exercise not found.' });
    res.json({ exercise: serializeCatalogRow(rows.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Error loading the exercise.', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

router.get('/routines', async (req, res) => {
  try {
    await gymReady();
    const [routines, week] = await Promise.all([
      pool.query(
        `SELECT id, name, emoji, exercises, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM user_routines WHERE user_id = $1 ORDER BY updated_at DESC`,
        [req.user.id]
      ),
      pool.query(
        `SELECT day, routine_id AS "routineId" FROM user_week WHERE user_id = $1 ORDER BY day, position`,
        [req.user.id]
      ),
    ]);
    const weekMap = {};
    week.rows.forEach((r) => {
      weekMap[r.day] = weekMap[r.day] || [];
      weekMap[r.day].push(r.routineId);
    });
    res.json({ routines: routines.rows.map(serializeRoutine), week: weekMap });
  } catch (error) {
    res.status(500).json({ message: 'Could not load routines.', error: error.message });
  }
});

router.post('/routines', async (req, res) => {
  try {
    await gymReady();
    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (!name) return res.status(400).json({ message: 'The routine needs a name.' });
    const emoji = String(req.body?.emoji || '💪').slice(0, 8) || '💪';
    const exercises = sanitizeRoutineExercises(req.body?.exercises);
    const result = await pool.query(
      `INSERT INTO user_routines (user_id, name, emoji, exercises)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, name, emoji, exercises, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.user.id, name, emoji, JSON.stringify(exercises)]
    );
    res.status(201).json({ message: 'Routine created.', routine: serializeRoutine(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Could not create the routine.', error: error.message });
  }
});

async function loadOwnRoutine(userId, routineId) {
  const rows = await pool.query(
    `SELECT id, name, emoji, exercises, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM user_routines WHERE id = $1 AND user_id = $2`,
    [routineId, userId]
  );
  return rows.rows[0] ? serializeRoutine(rows.rows[0]) : null;
}

router.get('/routines/:id', async (req, res) => {
  try {
    await gymReady();
    const routine = await loadOwnRoutine(req.user.id, req.params.id);
    if (!routine) return res.status(404).json({ message: 'Routine not found.' });
    res.json({ routine });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the routine.', error: error.message });
  }
});

router.put('/routines/:id', async (req, res) => {
  try {
    await gymReady();
    const existing = await loadOwnRoutine(req.user.id, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Routine not found.' });
    const name = req.body?.name !== undefined ? String(req.body.name).trim().slice(0, 120) : existing.name;
    if (!name) return res.status(400).json({ message: 'The routine needs a name.' });
    const emoji = req.body?.emoji !== undefined ? String(req.body.emoji).slice(0, 8) : existing.emoji;
    const exercises = req.body?.exercises !== undefined ? sanitizeRoutineExercises(req.body.exercises) : existing.exercises;
    const result = await pool.query(
      `UPDATE user_routines SET name = $3, emoji = $4, exercises = $5::jsonb, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, name, emoji, exercises, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, req.user.id, name, emoji, JSON.stringify(exercises)]
    );
    res.json({ message: 'Routine updated.', routine: serializeRoutine(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Could not update the routine.', error: error.message });
  }
});

router.delete('/routines/:id', async (req, res) => {
  try {
    await gymReady();
    const result = await pool.query('DELETE FROM user_routines WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id, req.user.id,
    ]);
    if (!result.rows.length) return res.status(404).json({ message: 'Routine not found.' });
    res.json({ id: result.rows[0].id, message: 'Routine deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete the routine.', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Weekly plan
// ---------------------------------------------------------------------------

router.get('/week', async (req, res) => {
  try {
    await gymReady();
    const rows = await pool.query(
      `SELECT day, routine_id AS "routineId" FROM user_week WHERE user_id = $1 ORDER BY day, position`,
      [req.user.id]
    );
    const week = {};
    rows.rows.forEach((r) => {
      week[r.day] = week[r.day] || [];
      week[r.day].push(r.routineId);
    });
    res.json({ week, dayNames: DAY_NAMES });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the week.', error: error.message });
  }
});

router.put('/week', async (req, res) => {
  try {
    await gymReady();
    const week = req.body?.week;
    if (!week || typeof week !== 'object' || Array.isArray(week)) {
      return res.status(400).json({ message: 'Invalid week format.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_week WHERE user_id = $1', [req.user.id]);
      for (const day of Object.keys(week)) {
        const d = Number(day);
        if (!Number.isInteger(d) || d < 1 || d > 7) continue;
        const ids = Array.isArray(week[day]) ? week[day] : [week[day]];
        const seen = new Set();
        let position = 0;
        for (const routineId of ids) {
          if (typeof routineId !== 'string' || seen.has(routineId)) continue;
          seen.add(routineId);
          const owns = await client.query('SELECT 1 FROM user_routines WHERE id = $1 AND user_id = $2', [routineId, req.user.id]);
          if (!owns.rows.length) continue;
          await client.query(
            `INSERT INTO user_week (user_id, day, routine_id, position) VALUES ($1, $2, $3, $4)`,
            [req.user.id, d, routineId, position++]
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const rows = await pool.query(
      `SELECT day, routine_id AS "routineId" FROM user_week WHERE user_id = $1 ORDER BY day, position`,
      [req.user.id]
    );
    const out = {};
    rows.rows.forEach((r) => {
      out[r.day] = out[r.day] || [];
      out[r.day].push(r.routineId);
    });
    res.json({ week: out, message: 'Week saved.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not save the week.', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Starter plans (ported from openGym lib/starter.js)
// ---------------------------------------------------------------------------

const STARTER_ROUTINES = {
  ppl: [
    ['push', 'Push Day', '🏋️', [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]]],
    ['pull', 'Pull Day', '💪', [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]]],
    ['legs', 'Leg Day', '🦵', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]],
  ],
  'upper-lower': [
    ['upper-a', 'Upper A', '🏋️', [['0025', 3, 8], ['2330', 3, 10], ['0047', 2, 10], ['1323', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0031', 2, 12]]],
    ['lower-a', 'Lower A', '🦵', [['0043', 3, 8], ['0085', 3, 8], ['0739', 2, 10], ['0586', 2, 12], ['0605', 3, 15]]],
    ['upper-b', 'Upper B', '🏋️', [['0047', 3, 8], ['0027', 3, 8], ['0426', 2, 10], ['2330', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0313', 2, 12]]],
    ['lower-b', 'Lower B', '🦵', [['0739', 3, 10], ['0085', 2, 10], ['0585', 2, 12], ['0586', 3, 12], ['0605', 3, 15]]],
  ],
  'full-body': [
    ['fb-a', 'Full Body A', '🔥', [['0043', 3, 8], ['0025', 3, 8], ['2330', 3, 10], ['0586', 3, 12], ['0334', 2, 12], ['0031', 2, 12]]],
    ['fb-b', 'Full Body B', '🔥', [['0085', 3, 8], ['0047', 3, 10], ['1323', 3, 10], ['0585', 3, 12], ['0334', 2, 12], ['0241', 2, 12]]],
    ['fb-c', 'Full Body C', '🔥', [['0739', 3, 10], ['0025', 2, 10], ['0027', 3, 10], ['0426', 2, 10], ['0586', 3, 12], ['0605', 3, 15]]],
  ],
  '5x5': [
    ['5x5-a', '5x5 A', '🏋️', [['0043', 5, 5], ['0025', 5, 5], ['0027', 5, 5]]],
    ['5x5-b', '5x5 B', '🏋️', [['0085', 5, 5], ['0426', 5, 5], ['2330', 5, 5]]],
    ['5x5-c', '5x5 C', '🏋️', [['0739', 5, 5], ['0047', 5, 5], ['1323', 5, 5]]],
  ],
};

const STARTER_SCHEDULES = {
  ppl: [[1, 'push'], [3, 'pull'], [5, 'legs']],
  'upper-lower': [[1, 'upper-a'], [2, 'lower-a'], [4, 'upper-b'], [5, 'lower-b']],
  'full-body': [[1, 'fb-a'], [3, 'fb-b'], [5, 'fb-c']],
  '5x5': [[1, '5x5-a'], [3, '5x5-b'], [5, '5x5-c']],
};

router.get('/week/starter-options', async (req, res) => {
  try {
    await gymReady();
    res.json({
      options: Object.entries(STARTER_SCHEDULES).map(([id, schedule]) => ({
        id,
        days: schedule.length,
        routines: STARTER_SCHEDULES[id].length,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the plans.', error: error.message });
  }
});

router.post('/week/starter', async (req, res) => {
  try {
    await gymReady();
    const planId = String(req.body?.plan || '').trim();
    const source = STARTER_ROUTINES[planId];
    const schedule = STARTER_SCHEDULES[planId];
    if (!source || !schedule) return res.status(400).json({ message: 'Unknown starter plan.' });

    // Exercise names for the snapshot
    const allIds = source.flatMap(([, , , list]) => list.map(([id]) => id));
    const catalogRows = await pool.query(`${CATALOG_SELECT} WHERE id = ANY($1::varchar[])`, [allIds]);
    const nameOf = {};
    catalogRows.rows.forEach((r) => { nameOf[r.id] = r.nameEs || r.name; });

    const client = await pool.connect();
    const created = [];
    try {
      await client.query('BEGIN');
      for (const [key, name, emoji, list] of source) {
        const exercises = list.map(([id, sets, reps]) => ({
          id, name: nameOf[id] || id, sets, reps, weight: 0, restSec: 90,
        }));
        const result = await client.query(
          `INSERT INTO user_routines (user_id, name, emoji, exercises)
           VALUES ($1, $2, $3, $4::jsonb)
           RETURNING id, name, emoji, exercises, created_at AS "createdAt", updated_at AS "updatedAt"`,
          [req.user.id, name, emoji, JSON.stringify(exercises)]
        );
        created.push(serializeRoutine(result.rows[0]));
      }
      // The plan claims its days (like openGym: scheduled days are replaced)
      for (const [day] of schedule) {
        await client.query('DELETE FROM user_week WHERE user_id = $1 AND day = $2', [req.user.id, day]);
      }
      const byKey = Object.fromEntries(source.map(([key], i) => [key, created[i].id]));
      for (const [day, key] of schedule) {
        await client.query(
          `INSERT INTO user_week (user_id, day, routine_id, position) VALUES ($1, $2, $3, 0)`,
          [req.user.id, day, byKey[key]]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.status(201).json({ message: 'Starter plan loaded.', routines: created, schedule });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the starter plan.', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Workouts (sessions)
// ---------------------------------------------------------------------------

// Last session for each exercise: to pre-fill weights like openGym.
async function lastPerformanceMap(userId, exIds) {
  if (!exIds.length) return {};
  const rows = await pool.query(
    `SELECT entries FROM user_workouts
     WHERE user_id = $1 AND state = 'done'
     ORDER BY started_at DESC LIMIT 40`,
    [userId]
  );
  const map = {};
  for (const row of rows.rows) {
    for (const en of row.entries || []) {
      if (!en?.exId || !(exIds.includes(en.exId)) || map[en.exId]) continue;
      const workRows = (en.rows || []).filter((r) => r.phase !== 'warmup' && Number(r?.w) > 0);
      if (!workRows.length) continue;
      const best = workRows.reduce((a, b) => (Number(b.w) > Number(a.w) ? b : a));
      map[en.exId] = { w: Number(best.w), r: Number(best.r), date: null };
    }
  }
  return map;
}

router.get('/workouts/active', async (req, res) => {
  try {
    await gymReady();
    const rows = await pool.query(
      `${WORKOUT_SELECT} WHERE user_id = $1 AND state = 'active' ORDER BY started_at DESC LIMIT 1`,
      [req.user.id]
    );
    res.json({ workout: rows.rows[0] ? serializeWorkout(rows.rows[0]) : null });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the active session.', error: error.message });
  }
});

router.get('/workouts', async (req, res) => {
  try {
    await gymReady();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const [rows, total] = await Promise.all([
      pool.query(
        `${WORKOUT_SELECT} WHERE user_id = $1 AND state = 'done' ORDER BY finished_at DESC NULLS LAST, started_at DESC LIMIT ${limit} OFFSET ${offset}`,
        [req.user.id]
      ),
      pool.query(`SELECT COUNT(*)::int AS n FROM user_workouts WHERE user_id = $1 AND state = 'done'`, [req.user.id]),
    ]);
    res.json({ workouts: rows.rows.map(serializeWorkout), total: total.rows[0].n });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the history.', error: error.message });
  }
});

router.post('/workouts', async (req, res) => {
  try {
    await gymReady();
    // Prevent two active sessions at once (like openGym, which starts today's)
    const existing = await pool.query(
      `${WORKOUT_SELECT} WHERE user_id = $1 AND state = 'active' ORDER BY started_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ message: 'You already have a session in progress.', workout: serializeWorkout(existing.rows[0]) });
    }

    const routineId = typeof req.body?.routineId === 'string' && req.body.routineId ? req.body.routineId : null;
    let name = 'Free session';
    let entries = [];

    if (routineId) {
      const routine = await loadOwnRoutine(req.user.id, routineId);
      if (!routine) return res.status(404).json({ message: 'Routine not found.' });
      name = routine.name;
      const last = await lastPerformanceMap(req.user.id, routine.exercises.map((ex) => ex.id));
      entries = routine.exercises.map((ex) => ({
        exId: ex.id,
        name: ex.name,
        cfg: {
          sets: ex.sets, reps: ex.reps,
          weight: ex.weight > 0 ? ex.weight : (last[ex.id]?.w ?? 0),
          restSec: ex.restSec || 90,
          unit: 'kg', mode: 'reps',
        },
        rows: [],
        ...(ex.note ? { note: ex.note } : {}),
        last: last[ex.id] ?? null,
      }));
    }

    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      name = req.body.name.trim().slice(0, 160);
    }

    const result = await pool.query(
      `INSERT INTO user_workouts (user_id, name, routine_id, entries)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING id, name, routine_id AS "routineId", entries, state,
       started_at AS "startedAt", finished_at AS "finishedAt", duration_sec AS "durationSec", notes`,
      [req.user.id, name, routineId, JSON.stringify(entries)]
    );
    res.status(201).json({ message: 'Session started.', workout: serializeWorkout(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Could not start the session.', error: error.message });
  }
});

async function loadOwnWorkout(userId, workoutId) {
  const rows = await pool.query(`${WORKOUT_SELECT} WHERE id = $1 AND user_id = $2`, [workoutId, userId]);
  return rows.rows[0] ? serializeWorkout(rows.rows[0]) : null;
}

router.get('/workouts/:id', async (req, res) => {
  try {
    await gymReady();
    const workout = await loadOwnWorkout(req.user.id, req.params.id);
    if (!workout) return res.status(404).json({ message: 'Session not found.' });
    res.json({ workout });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the session.', error: error.message });
  }
});

router.put('/workouts/:id', async (req, res) => {
  try {
    await gymReady();
    const existing = await loadOwnWorkout(req.user.id, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Session not found.' });
    const name = req.body?.name !== undefined ? String(req.body.name).trim().slice(0, 160) : existing.name;
    const notes = req.body?.notes !== undefined ? String(req.body.notes).slice(0, 4000) : existing.notes;
    const entries = req.body?.entries !== undefined ? sanitizeEntries(req.body.entries) : existing.entries;
    const result = await pool.query(
      `UPDATE user_workouts SET name = $3, notes = $4, entries = $5::jsonb
       WHERE id = $1 AND user_id = $2
       RETURNING id, name, routine_id AS "routineId", entries, state, started_at AS "startedAt",
       finished_at AS "finishedAt", duration_sec AS "durationSec", notes`,
      [req.params.id, req.user.id, name, notes, JSON.stringify(entries)]
    );
    res.json({ message: 'Session saved.', workout: serializeWorkout(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Could not save the session.', error: error.message });
  }
});

router.post('/workouts/:id/finish', async (req, res) => {
  try {
    await gymReady();
    const existing = await loadOwnWorkout(req.user.id, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Session not found.' });
    if (existing.state === 'done') return res.json({ message: 'It was already finished.', workout: existing });

    const entries = req.body?.entries !== undefined ? sanitizeEntries(req.body.entries) : existing.entries;
    const durationSec = Math.max(
      0,
      Math.round((Date.now() - new Date(existing.startedAt).getTime()) / 1000)
    );
    const result = await pool.query(
      `UPDATE user_workouts SET state = 'done', entries = $3::jsonb, finished_at = NOW(), duration_sec = $4
       WHERE id = $1 AND user_id = $2
       RETURNING id, name, routine_id AS "routineId", entries, state, started_at AS "startedAt",
       finished_at AS "finishedAt", duration_sec AS "durationSec", notes`,
      [req.params.id, req.user.id, JSON.stringify(entries), durationSec]
    );
    res.json({ message: 'Session complete!', workout: serializeWorkout(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ message: 'Could not finish the session.', error: error.message });
  }
});

router.delete('/workouts/:id', async (req, res) => {
  try {
    await gymReady();
    const result = await pool.query('DELETE FROM user_workouts WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id, req.user.id,
    ]);
    if (!result.rows.length) return res.status(404).json({ message: 'Session not found.' });
    res.json({ id: result.rows[0].id, message: 'Session deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete the session.', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Body weight
// ---------------------------------------------------------------------------

router.get('/bodyweight', async (req, res) => {
  try {
    await gymReady();
    const limit = Math.min(365, Math.max(1, Number(req.query.limit) || 90));
    const rows = await pool.query(
      `SELECT id, to_char(weighed_on, 'YYYY-MM-DD') AS "weighedOn", weight FROM user_bodyweight
       WHERE user_id = $1 ORDER BY weighed_on DESC LIMIT ${limit}`,
      [req.user.id]
    );
    res.json({
      entries: rows.rows.map((r) => ({
        id: r.id, weighedOn: r.weighedOn, weight: Number(r.weight),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the weight.', error: error.message });
  }
});

router.post('/bodyweight', async (req, res) => {
  try {
    await gymReady();
    const weight = Number(req.body?.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
      return res.status(400).json({ message: 'Invalid weight.' });
    }
    const weighedOn = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.weighedOn))
      ? req.body.weighedOn
      : localDayStr();
    const result = await pool.query(
      `INSERT INTO user_bodyweight (user_id, weighed_on, weight) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, weighed_on) DO UPDATE SET weight = EXCLUDED.weight
       RETURNING id, to_char(weighed_on, 'YYYY-MM-DD') AS "weighedOn", weight`,
      [req.user.id, weighedOn, weight]
    );
    res.status(201).json({
      message: 'Weight saved.',
      entry: { id: result.rows[0].id, weighedOn: result.rows[0].weighedOn, weight: Number(result.rows[0].weight) },
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not save the weight.', error: error.message });
  }
});

router.delete('/bodyweight/:id', async (req, res) => {
  try {
    await gymReady();
    const result = await pool.query('DELETE FROM user_bodyweight WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id, req.user.id,
    ]);
    if (!result.rows.length) return res.status(404).json({ message: 'Entry not found.' });
    res.json({ id: result.rows[0].id, message: 'Entry deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete the entry.', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function volumeOf(entries) {
  let volume = 0;
  let sets = 0;
  let reps = 0;
  for (const en of entries || []) {
    for (const r of (en?.rows || [])) {
      if (r.phase === 'warmup') continue;
      volume += (Number(r.w) || 0) * (Number(r.r) || 0);
      sets += 1;
      reps += Number(r.r) || 0;
    }
  }
  return { volume, sets, reps };
}

router.get('/stats/summary', async (req, res) => {
  try {
    await gymReady();
    const [totals, month, recent, weights] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM user_workouts WHERE user_id = $1 AND state = 'done'`, [req.user.id]),
      pool.query(
        `SELECT COUNT(*)::int AS n
         FROM user_workouts
         WHERE user_id = $1 AND state = 'done' AND started_at >= date_trunc('month', NOW())`,
        [req.user.id]
      ),
      pool.query(
        `${WORKOUT_SELECT} WHERE user_id = $1 AND state = 'done'
         ORDER BY finished_at DESC NULLS LAST, started_at DESC LIMIT 60`,
        [req.user.id]
      ),
      pool.query(
        `SELECT to_char(weighed_on, 'YYYY-MM-DD') AS "weighedOn", weight FROM user_bodyweight
         WHERE user_id = $1 ORDER BY weighed_on DESC LIMIT 60`,
        [req.user.id]
      ),
    ]);

    const workouts = recent.rows.map(serializeWorkout);

    // Volume per week (last 12) and week streak
    const weekBuckets = new Map(); // monday ISO -> volume
    const weekHasWorkout = new Set();
    let monthVolume = 0;
    for (const w of workouts) {
      const startedAt = new Date(w.finishedAt || w.startedAt);
      const monday = new Date(startedAt);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const { volume } = volumeOf(w.entries);
      weekBuckets.set(key, (weekBuckets.get(key) || 0) + volume);
      weekHasWorkout.add(key);
      if (startedAt >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)) {
        monthVolume += volume;
      }
    }

    const nowMonday = new Date();
    nowMonday.setHours(0, 0, 0, 0);
    nowMonday.setDate(nowMonday.getDate() - ((nowMonday.getDay() + 6) % 7));
    let streakWeeks = 0;
    for (let i = 0; i < 52; i++) {
      const key = new Date(nowMonday.getTime() - i * 7 * 86400000).toISOString().slice(0, 10);
      if (weekHasWorkout.has(key)) streakWeeks++;
      else if (i > 0) break; // the current week without training does not break the streak yet
    }

    const weeklyVolume = [];
    for (let i = 11; i >= 0; i--) {
      const key = new Date(nowMonday.getTime() - i * 7 * 86400000).toISOString().slice(0, 10);
      weeklyVolume.push({ week: key, volume: Math.round(weekBuckets.get(key) || 0) });
    }

    // PRs: best set per exercise (weight, with its reps)
    const prs = [];
    const prMap = new Map();
    for (const w of [...workouts].reverse()) {
      for (const en of w.entries || []) {
        for (const r of (en.rows || [])) {
          if (r.phase === 'warmup' || !(Number(r.w) > 0)) continue;
          const cur = prMap.get(en.exId);
          if (!cur || Number(r.w) > cur.w || (Number(r.w) === cur.w && Number(r.r) > cur.r)) {
            prMap.set(en.exId, { w: Number(r.w), r: Number(r.r), date: w.finishedAt || w.startedAt, name: en.name, exId: en.exId });
          }
        }
      }
    }
    for (const pr of prMap.values()) prs.push(pr);
    prs.sort((a, b) => new Date(b.date) - new Date(a.date));

    const bodyweightSeries = weights.rows
      .map((r) => ({ weighedOn: r.weighedOn, weight: Number(r.weight) }))
      .reverse();

    res.json({
      summary: {
        totalWorkouts: totals.rows[0].n,
        thisMonth: month.rows[0].n,
        monthVolume: Math.round(monthVolume),
        streakWeeks,
        weeklyVolume,
        prs: prs.slice(0, 20),
        bodyweight: bodyweightSeries.length ? bodyweightSeries[bodyweightSeries.length - 1] : null,
        bodyweightSeries,
      },
      recentWorkouts: workouts.slice(0, 10),
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the stats.', error: error.message });
  }
});

router.get('/stats/exercise/:exId', async (req, res) => {
  try {
    await gymReady();
    const exId = String(req.params.exId || '').trim();
    const rows = await pool.query(
      `${WORKOUT_SELECT} WHERE user_id = $1 AND state = 'done' AND entries::text LIKE $2
       ORDER BY finished_at DESC NULLS LAST, started_at DESC LIMIT 50`,
      [req.user.id, `%"${exId}"%`]
    );
    const sessions = [];
    let best = null;
    let totalVolume = 0;
    for (const row of rows.rows) {
      const w = serializeWorkout(row);
      const entry = (w.entries || []).find((e) => e.exId === exId);
      if (!entry) continue;
      const workRows = (entry.rows || []).filter((r) => r.phase !== 'warmup');
      if (!workRows.length) continue;
      const volume = workRows.reduce((v, r) => v + (Number(r.w) || 0) * (Number(r.r) || 0), 0);
      totalVolume += volume;
      const top = workRows.reduce((a, b) => (Number(b.w) > Number(a.w) ? b : a));
      const est1rm = Math.round(Number(top.w) * (1 + Number(top.r) / 30));
      if (!best || Number(top.w) > best.w) {
        best = { w: Number(top.w), r: Number(top.r), est1rm, date: w.finishedAt || w.startedAt };
      }
      sessions.push({
        id: w.id,
        workoutName: w.name,
        date: w.finishedAt || w.startedAt,
        rows: workRows.map((r) => ({ w: Number(r.w), r: Number(r.r) })),
        volume,
      });
    }
    const lastSession = sessions[0] || null;
    const lastRows = lastSession ? lastSession.rows : [];
    res.json({ exId, sessions, best, last: lastRows.length ? lastRows[lastRows.length - 1] : null, totalVolume });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the exercise stats.', error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Home: everything the main screen needs in one call
// ---------------------------------------------------------------------------

function isoDayOfWeek(date) {
  // Monday=1 .. Sunday=7 (like openGym's model)
  return ((date.getDay() + 6) % 7) + 1;
}

function localDayStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

router.get('/home', async (req, res) => {
  try {
    await gymReady();
    const today = new Date();
    const day = isoDayOfWeek(today);

    const [weekRows, active, summaryRes, weightRows] = await Promise.all([
      pool.query(
        `SELECT day, routine_id AS "routineId" FROM user_week WHERE user_id = $1 ORDER BY day, position`,
        [req.user.id]
      ),
      pool.query(
        `${WORKOUT_SELECT} WHERE user_id = $1 AND state = 'active' ORDER BY started_at DESC LIMIT 1`,
        [req.user.id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE started_at >= date_trunc('month', NOW()))::int AS month
         FROM user_workouts WHERE user_id = $1 AND state = 'done'`,
        [req.user.id]
      ),
      pool.query(
        `SELECT to_char(weighed_on, 'YYYY-MM-DD') AS "weighedOn", weight FROM user_bodyweight
         WHERE user_id = $1 ORDER BY weighed_on DESC LIMIT 1`,
        [req.user.id]
      ),
    ]);

    const week = {};
    weekRows.rows.forEach((r) => {
      week[r.day] = week[r.day] || [];
      week[r.day].push(r.routineId);
    });

    const todayRoutineIds = week[day] || [];
    let todayRoutines = [];
    if (todayRoutineIds.length) {
      const rows = await pool.query(
        `SELECT id, name, emoji, exercises FROM user_routines WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [req.user.id, todayRoutineIds]
      );
      todayRoutines = rows.rows.map((r) => ({
        id: r.id, name: r.name, emoji: r.emoji,
        exerciseCount: (r.exercises || []).length,
      }));
    }

    const lastWorkout = await pool.query(
      `${WORKOUT_SELECT} WHERE user_id = $1 AND state = 'done'
       ORDER BY finished_at DESC NULLS LAST, started_at DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      day,
      dayName: DAY_NAMES[day],
      week,
      todayRoutines,
      activeWorkout: active.rows[0] ? serializeWorkout(active.rows[0]) : null,
      totals: { total: summaryRes.rows[0].total, thisMonth: summaryRes.rows[0].month },
      lastWorkout: lastWorkout.rows[0] ? serializeWorkout(lastWorkout.rows[0]) : null,
      bodyweight: weightRows.rows[0] ? { weighedOn: weightRows.rows[0].weighedOn, weight: Number(weightRows.rows[0].weight) } : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the home screen.', error: error.message });
  }
});

module.exports = { router, gymReady };
