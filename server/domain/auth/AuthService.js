/**
 * ⚡ DOMAIN LAYER — AUTHENTICATION SERVICE
 * =============================================================================
 * Responsibility: Secure identity management using Supabase and JWT.
 * =============================================================================
 */

'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../../infra/supabase');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

// ── Validation helpers ───────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistrationInput({ email, password, username, dob, ageConsent }) {
    const errors = [];
    if (!email || !EMAIL_RE.test(email))          errors.push('Valid email required');
    if (!password || password.length < 8)          errors.push('Password must be at least 8 characters');
    if (!username || !USERNAME_RE.test(username))  errors.push('Username must be 3-30 chars');
    if (!dob)                                       errors.push('Date of birth required');
    if (!ageConsent)                                errors.push('Age consent must be confirmed');

    if (dob) {
        const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (age < 13) errors.push('Must be at least 13 years old');
    }
    return errors;
}

// ── Token helpers ────────────────────────────────────────────────────────────

function signAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function verifyAccessToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

async function issueRefreshToken(userId) {
    const token = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
    
    const { error } = await supabase
        .from('refresh_tokens')
        .insert({ token, user_id: userId, expires_at: expiresAt });

    if (error) throw new Error(`Refresh token issue failed: ${error.message}`);
    return token;
}

// ── Core auth operations ─────────────────────────────────────────────────────

async function register({ email, password, username, displayName, country, serverRegion, dob, ageConsent }) {
    const errors = validateRegistrationInput({ email, password, username, dob, ageConsent });
    if (errors.length) throw new Error(errors[0]);

    const normalizedEmail    = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    // Check availability
    const { data: existing } = await supabase
        .from('users')
        .select('id, email, username')
        .or(`email.eq.${normalizedEmail},username.eq.${normalizedUsername}`)
        .maybeSingle();

    if (existing) {
        if (existing.email === normalizedEmail) throw new Error('Email already registered');
        throw new Error('Username already taken');
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: user, error } = await supabase
        .from('users')
        .insert({
            id,
            email: normalizedEmail,
            password_hash: passwordHash,
            username: normalizedUsername,
            display_name: displayName?.trim().slice(0, 80) || normalizedUsername,
            country: country || null,
            server_region: serverRegion || null,
            dob,
            role: normalizedEmail === 'alphabravo2k@gmail.com' ? 'platform_admin' : 'player'
        })
        .select()
        .single();

    if (error) throw new Error(`Registration failed: ${error.message}`);

    const accessToken  = signAccessToken({ sub: id, username: normalizedUsername, role: 'user' });
    const refreshToken = await issueRefreshToken(id);

    return { user: { id, email: normalizedEmail, username: normalizedUsername, role: 'user' }, accessToken, refreshToken };
}

async function login({ email, password }) {
    if (!email || !password) throw new Error('Email and password required');

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .single();

    const dummyHash = '$2b$12$invalidhashfortimingsafetyxxxxxxxxxxxxxxxxxxxxxxxx';
    const match = await bcrypt.compare(password, user ? user.password_hash : dummyHash);

    if (!user || !match) throw new Error('Invalid email or password');
    if (user.suspended) throw new Error('Account suspended');

    const accessToken  = signAccessToken({ sub: user.id, username: user.username, role: user.role });
    const refreshTokenValue = await issueRefreshToken(user.id);

    return {
        user: { id: user.id, email: user.email, username: user.username, role: user.role, displayName: user.display_name },
        accessToken,
        refreshToken: refreshTokenValue,
    };
}

async function refreshToken(token) {
    if (!token) throw new Error('Refresh token required');

    const { data: stored, error: fetchErr } = await supabase
        .from('refresh_tokens')
        .select('*')
        .eq('token', token)
        .single();

    if (fetchErr || !stored) throw new Error('Invalid or expired refresh token');

    if (new Date(stored.expires_at) < new Date()) {
        await supabase.from('refresh_tokens').delete().eq('token', token);
        throw new Error('Refresh token expired');
    }

    // Token rotation
    await supabase.from('refresh_tokens').delete().eq('token', token);

    const { data: user } = await supabase
        .from('users')
        .select('id, username, role')
        .eq('id', stored.user_id)
        .single();

    if (!user) throw new Error('User not found');

    const newAccessToken  = signAccessToken({ sub: user.id, username: user.username, role: user.role });
    const newRefreshTokenValue = await issueRefreshToken(user.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshTokenValue };
}

async function logout(token) {
    if (token) {
        await db.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    }
}

module.exports = { register, login, refreshToken, logout, verifyAccessToken };
