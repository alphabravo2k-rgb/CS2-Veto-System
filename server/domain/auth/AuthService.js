/**
 * ⚡ DOMAIN LAYER — AUTHENTICATION SERVICE
 * =============================================================================
 * PROBLEM (Security Vulnerability): The original system had ZERO user
 * authentication. Any client could create matches with any team names and
 * potentially manipulate veto sessions if they obtained a key URL.
 * There was no concept of identity — only a single global ADMIN_SECRET.
 *
 * FIX: Full JWT-based auth with bcrypt hashing, access token + rotating
 * refresh tokens. All tokens are server-issued and server-validated.
 * =============================================================================
 */

'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../../infra/database');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('[AUTH] FATAL: JWT_SECRET must be set in production');
    process.exit(1);
}
const EFFECTIVE_SECRET = JWT_SECRET || 'dev_jwt_secret_change_in_production';

// ── Validation helpers ───────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistrationInput({ email, password, username, dob, ageConsent }) {
    const errors = [];
    if (!email || !EMAIL_RE.test(email))          errors.push('Valid email required');
    if (!password || password.length < 8)          errors.push('Password must be at least 8 characters');
    if (!username || !USERNAME_RE.test(username))  errors.push('Username must be 3-30 chars (letters, numbers, _ -)');
    if (!dob)                                       errors.push('Date of birth required');
    if (!ageConsent)                                errors.push('Age consent (13+) must be confirmed');

    if (dob) {
        const birthDate = new Date(dob);
        const age = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (isNaN(age) || age < 13) errors.push('You must be at least 13 years old to register');
    }

    return errors;
}

// ── Token helpers ────────────────────────────────────────────────────────────

function signAccessToken(payload) {
    return jwt.sign(payload, EFFECTIVE_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function verifyAccessToken(token) {
    return jwt.verify(token, EFFECTIVE_SECRET);
}

async function issueRefreshToken(userId) {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
    await db.run(
        `INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`,
        [token, userId, expiresAt]
    );
    return token;
}

// ── Core auth operations ─────────────────────────────────────────────────────

async function register({ email, password, username, displayName, country, serverRegion, dob, ageConsent }) {
    const errors = validateRegistrationInput({ email, password, username, dob, ageConsent });
    if (errors.length) throw Object.assign(new Error(errors[0]), { validation: errors, statusCode: 400 });

    const normalizedEmail    = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    // Check for duplicates — two separate checks for clear error messages
    const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existingEmail) throw Object.assign(new Error('Email already registered'), { statusCode: 409 });

    const existingUsername = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [normalizedUsername]);
    if (existingUsername) throw Object.assign(new Error('Username already taken'), { statusCode: 409 });

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await db.run(
        `INSERT INTO users
         (id, email, password_hash, username, display_name, country, server_region, dob, age_verified, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [id, normalizedEmail, passwordHash, normalizedUsername,
         displayName?.trim().slice(0, 80) || normalizedUsername,
         country || null, serverRegion || null, dob]
    );

    const accessToken  = signAccessToken({ sub: id, username: normalizedUsername, role: 'user' });
    const refreshToken = await issueRefreshToken(id);

    return {
        user: { id, email: normalizedEmail, username: normalizedUsername, role: 'user' },
        accessToken,
        refreshToken,
    };
}

async function login({ email, password }) {
    if (!email || !password) throw Object.assign(new Error('Email and password required'), { statusCode: 400 });

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);

    // FIX (Security): Always run bcrypt even on missing user to prevent timing attacks
    const dummyHash = '$2b$12$invalidhashfortimingsafetyxxxxxxxxxxxxxxxxxxxxxxxx';
    const hashToCheck = user ? user.password_hash : dummyHash;
    const match = await bcrypt.compare(password, hashToCheck);

    if (!user || !match) throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    if (user.suspended) throw Object.assign(new Error('Account suspended'), { statusCode: 403 });

    const accessToken  = signAccessToken({ sub: user.id, username: user.username, role: user.role });
    const refreshToken = await issueRefreshToken(user.id);

    return {
        user: { id: user.id, email: user.email, username: user.username, role: user.role, displayName: user.display_name },
        accessToken,
        refreshToken,
    };
}

async function refreshToken(token) {
    if (!token) throw Object.assign(new Error('Refresh token required'), { statusCode: 400 });

    const stored = await db.get(
        'SELECT * FROM refresh_tokens WHERE token = ?',
        [token]
    );

    if (!stored) throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });

    if (new Date(stored.expires_at) < new Date()) {
        await db.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
        throw Object.assign(new Error('Refresh token expired'), { statusCode: 401 });
    }

    // Token rotation — delete old, issue new
    await db.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);

    const user = await db.get('SELECT id, username, role FROM users WHERE id = ?', [stored.user_id]);
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    const newAccessToken  = signAccessToken({ sub: user.id, username: user.username, role: user.role });
    const newRefreshToken = await issueRefreshToken(user.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout(token) {
    if (token) {
        await db.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    }
}

module.exports = { register, login, refreshToken, logout, verifyAccessToken };
