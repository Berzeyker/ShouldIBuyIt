const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());

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
      return res.status(401).json({ message: 'No autorizado: token requerido.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = await validateSessionToken(token);

    if (!userId || decoded.id !== userId) {
      return res.status(401).json({ message: 'Sesión inválida o expirada.' });
    }

    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido.', error: error.message });
  }
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, message: 'API saludable y conectada a Neon' });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'No se pudo conectar a la base de datos', error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim(); //user password
    const email = String(req.body?.email || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });
    }

    await ensureSchema();

    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Este usuario ya existe.' });
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
      message: 'Usuario registrado correctamente.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at, //user registration
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error registrando usuario.', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos.' });
    }

    await ensureSchema();

    const result = await pool.query(
      'SELECT id, username, email, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash); //password validation

    if (!isValid) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    }

    const token = createToken(user);
    await saveSession(user.id, token);

    return res.json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error iniciando sesión.', error: error.message });
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
    res.status(500).json({ message: 'Error listando usuarios.', error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.json({ user: user.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Error obteniendo usuario actual.', error: error.message });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const token = getTokenFromHeader(req);
    await revokeSession(token);
    return res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo cerrar la sesión.', error: error.message });
  }
});

app.post('/api/auth/switch-user', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos para cambiar de cuenta.' });
    }

    await ensureSchema();

    const result = await pool.query(
      `SELECT id, username, email, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: 'La contraseña es incorrecta.' });
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
    return res.status(500).json({ message: 'Error cambiando de usuario.', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
