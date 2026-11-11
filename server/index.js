const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const { pool } = require('./db');
const { router: gymRouter } = require('./gym-routes');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());

// openGym catalog media (webp images and mp4 clips)
app.use('/ex', express.static(path.join(__dirname, 'public', 'ex'), { maxAge: '30d' }));

// Gym routes: catalog and auth are public; the rest require a session
app.use('/api', (req, res, next) => {
  const p = req.path;
  // Authenticated data is specific to each user: do not allow URL caching
  // (Chromium ignores Authorization when caching GETs and could serve
  // another session's response via 304). The catalog is public and cacheable.
  if (!p.startsWith('/catalog')) res.set('Cache-Control', 'no-store');
  if (p.startsWith('/catalog') || p.startsWith('/auth') || p === '/health') return next();
  return authMiddleware(req, res, next);
}, gymRouter);

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' }); //users 
}

function getTokenFromHeader(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null; 
  return token;
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(80) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email VARCHAR(160),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(120) NOT NULL,
      muscle_group VARCHAR(80) NOT NULL DEFAULT '',
      equipment VARCHAR(80) NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function saveSession(userId, token) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await pool.query(
    `INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

async function revokeSession(token) {
  if (!token) return;
  await pool.query(`DELETE FROM user_sessions WHERE token = $1`, [token]);
}

async function validateSessionToken(token) {
  if (!token) return null;

  const sessionResult = await pool.query(
    `SELECT user_id, expires_at FROM user_sessions WHERE token = $1`,
    [token]
  );

  if (sessionResult.rows.length === 0) {
    return null;
  }

  const session = sessionResult.rows[0];
  const isExpired = new Date(session.expires_at).getTime() < Date.now(); // Check if the session has expired

  if (isExpired) {
    await pool.query(`DELETE FROM user_sessions WHERE token = $1`, [token]);
    return null;
  }

  return session.user_id;
}

async function authMiddleware(req, res, next) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: token required.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = await validateSessionToken(token);

    if (!userId || decoded.id !== userId) {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }

    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.', error: error.message });
  }
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, message: 'API healthy and connected to Neon' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Could not connect to the database', error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim(); //user password
    const email = String(req.body?.email || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    await ensureSchema();

    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'This username already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `
        INSERT INTO users (username, password_hash, email)
        VALUES ($1, $2, $3)
        RETURNING id, username, email, created_at
      `,
      [username, passwordHash, email || null]
    );

    const user = result.rows[0];
    const token = createToken(user);
    await saveSession(user.id, token);

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at, //user registration
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error registering user.', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    await ensureSchema();

    const result = await pool.query(
      'SELECT id, username, email, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash); //password validation

    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    const token = createToken(user);
    await saveSession(user.id, token);

    return res.json({
      message: 'Signed in successfully.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error signing in.', error: error.message });
  }
});

app.get('/api/auth/users', async (req, res) => {
  try {
    await ensureSchema();
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users: result.rows.map((user) => ({ //user registrer
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
    })) });
  } catch (error) {
    res.status(500).json({ message: 'Error listing users.', error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: user.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Error getting the current user.', error: error.message });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    await revokeSession(token);
    return res.json({ ok: true, message: 'Session closed successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not close the session.', error: error.message });
  }
});

app.post('/api/auth/switch-user', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required to switch accounts.' });
    }

    await ensureSchema();

    const result = await pool.query(
      `SELECT id, username, email, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: 'The password is incorrect.' });
    }

    const token = createToken(user);
    await saveSession(user.id, token);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error switching user.', error: error.message });
  }
});

function serializeExercise(row) {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscleGroup,
    equipment: row.equipment,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const exerciseSelect = `
  SELECT id, name, muscle_group AS "muscleGroup", equipment, notes,
         created_at AS "createdAt", updated_at AS "updatedAt"
  FROM exercises
`;

function isValidExerciseId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function readExerciseInput(body, { partial = false } = {}) {
  const fields = {
    name: 'name',
    muscleGroup: 'muscle_group',
    equipment: 'equipment',
    notes: 'notes',
  };
  const maxLengths = { name: 120, muscleGroup: 80, equipment: 80 };
  const input = {};

  for (const [field, column] of Object.entries(fields)) {
    if (partial && !Object.hasOwn(body ?? {}, field)) continue;
    if (!partial && field !== 'name' && !Object.hasOwn(body ?? {}, field)) {
      input[column] = '';
      continue;
    }
    const value = body?.[field];
    if (typeof value !== 'string') {
      return { error: `The field ${field} must be text.` };
    }
    const normalizedValue = value.trim();
    if (maxLengths[field] && normalizedValue.length > maxLengths[field]) {
      return { error: `The field ${field} exceeds the maximum of ${maxLengths[field]} characters.` };
    }
    input[column] = normalizedValue;
  }

  if (!partial && !Object.hasOwn(input, 'name')) {
    return { error: 'The exercise name is required.' };
  }
  if (Object.hasOwn(input, 'name') && !input.name) {
    return { error: 'The exercise name is required.' };
  }
  if (Object.keys(input).length === 0) {
    return { error: 'Provide at least one field to update.' };
  }

  return { input };
}

app.get('/api/exercises', async (req, res) => {
  try {
    await ensureSchema();
    const result = await pool.query(`${exerciseSelect} ORDER BY created_at DESC`);
    return res.json({ exercises: result.rows.map(serializeExercise) });
  } catch (error) {
    console.error('Error listing exercises:', error);
    return res.status(500).json({ message: 'Could not load exercises.' });
  }
});

app.post('/api/exercises', async (req, res) => {
  const { input, error } = readExerciseInput(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    await ensureSchema();
    const result = await pool.query(
      `INSERT INTO exercises (name, muscle_group, equipment, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, muscle_group AS "muscleGroup", equipment, notes,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [input.name, input.muscle_group, input.equipment, input.notes]
    );
    return res.status(201).json({
      message: 'Exercise created successfully.',
      exercise: serializeExercise(result.rows[0]),
    });
  } catch (error) {
    console.error('Error creating exercise:', error);
    return res.status(500).json({ message: 'Could not create the exercise.' });
  }
});

async function updateExercise(req, res, { partial = false } = {}) {
  if (!isValidExerciseId(req.params.id)) {
    return res.status(400).json({ message: 'The exercise identifier is not valid.' });
  }

  const { input, error } = readExerciseInput(req.body, { partial });
  if (error) return res.status(400).json({ message: error });

  const columns = Object.keys(input);
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
  assignments.push('updated_at = NOW()');
  const values = columns.map((column) => input[column]);
  values.push(req.params.id);

  try {
    await ensureSchema();
    const result = await pool.query(
      `UPDATE exercises SET ${assignments.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, name, muscle_group AS "muscleGroup", equipment, notes,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Exercise not found.' });
    }
    return res.json({
      message: 'Exercise updated successfully.',
      exercise: serializeExercise(result.rows[0]),
    });
  } catch (error) {
    console.error('Error updating exercise:', error);
    return res.status(500).json({ message: 'Could not update the exercise.' });
  }
}

app.put('/api/exercises/:id', (req, res) => updateExercise(req, res));
app.patch('/api/exercises/:id', (req, res) => updateExercise(req, res, { partial: true }));

app.delete('/api/exercises/:id', async (req, res) => {
  if (!isValidExerciseId(req.params.id)) {
    return res.status(400).json({ message: 'The exercise identifier is not valid.' });
  }

  try {
    await ensureSchema();
    const result = await pool.query(
      'DELETE FROM exercises WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Exercise not found.' });
    }
    return res.json({
      id: result.rows[0].id,
      message: 'Exercise deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting exercise:', error);
    return res.status(500).json({ message: 'Could not delete the exercise.' });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
