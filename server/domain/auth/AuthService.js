/**
 * ⚡ DOMAIN LAYER — AUTHENTICATION SERVICE (SUPABASE NATIVE)
 * =============================================================================
 * Responsibility: Secure identity management using Supabase Auth and JWT.
 * Features: Admin-mediated registration, native login, and manual token rotation.
 * =============================================================================
 */

'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../../infra/supabase');

const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

// ── Validation Helpers ───────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistrationInput({ email, password, username, dob, ageConsent }) {
    const errors = [];
    if (!email || !EMAIL_RE.test(email))            errors.push('Valid email required');
    if (!password || password.length < 8)            errors.push('Password must be at least 8 characters');
    if (!username || !USERNAME_RE.test(username))    errors.push('Username must be 3-30 chars');
    if (!dob)                                         errors.push('Date of birth required');
    if (!ageConsent)                                  errors.push('Age consent must be confirmed');

    if (dob) {
        const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (age < 13) errors.push('Must be at least 13 years old');
    }
    return errors;
}

// ── Token Helpers ────────────────────────────────────────────────────────────

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

// ── Core Auth Operations ─────────────────────────────────────────────────────

async function register({ email, password, username, displayName, country, serverRegion, dob, ageConsent }) {
    const errors = validateRegistrationInput({ email, password, username, dob, ageConsent });
    if (errors.length) throw new Error(errors[0]);

    const normalizedEmail    = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    // 1. Create the user in Supabase Auth (Native)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: true,
        user_metadata: { username: normalizedUsername }
    });

    if (authError) throw new Error(`Auth creation failed: ${authError.message}`);

    // 2. Sync profile to public.users table
    const role = normalizedEmail === 'alphabravo2k@gmail.com' ? 'platform_admin' : 'player';
    const { data: user, error: profileError } = await supabase
        .from('users')
        .insert({
            id: authData.user.id,
            email: normalizedEmail,
            username: normalizedUsername,
            display_name: displayName?.trim() || normalizedUsername,
            country: country || null,
            server_region: serverRegion || null,
            dob,
            role,
            age_verified: true
        })
        .select()
        .single();

    if (profileError) {
        // Cleanup on profile sync failure
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Profile sync failed: ${profileError.message}`);
    }

    const accessToken  = signAccessToken({ sub: user.id, username: user.username, role: user.role });
    const refreshTokenValue = await issueRefreshToken(user.id);

    return { user, accessToken, refreshToken: refreshTokenValue };
}

const { authenticator } = require('otplib');
const qrcode = require('qrcode');

// ... (existing helpers)

async function login({ email, password, totpCode }) {
    if (!email || !password) throw new Error('Email and password required');

    // 1. Authenticate with Supabase Auth (Native)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
    });

    if (authError) throw new Error('Invalid email or password');

    // 2. Fetch profile from public.users table
    const { data: user, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profileError || !user) throw new Error('Account profile missing');
    if (user.suspended) throw new Error('Account suspended');

    // 3. 2FA Enforcement (Fixes Gap 2.6)
    if (user.totp_enabled) {
        if (!totpCode) {
            return { mfaRequired: true, userId: user.id };
        }
        const isValid = authenticator.check(totpCode, user.totp_secret);
        if (!isValid) throw new Error('Invalid 2FA code');
    }

    const accessToken  = signAccessToken({ sub: user.id, username: user.username, role: user.role });
    const refreshTokenValue = await issueRefreshToken(user.id);

    return {
        user,
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
        await supabase.from('refresh_tokens').delete().eq('token', token);
    }
}

/**
 * Setup 2FA for a user.
 */
async function setup2FA(userId) {
    const { data: user } = await supabase.from('users').select('username, email').eq('id', userId).single();
    if (!user) throw new Error('User not found');

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'CS2-Veto-System', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    // Temporarily save secret until verified
    await supabase.from('users').update({ totp_secret: secret }).eq('id', userId);

    return { secret, qrCodeUrl };
}

/**
 * Verify and enable 2FA.
 */
async function verifyAndEnable2FA(userId, code) {
    const { data: user } = await supabase.from('users').select('totp_secret').eq('id', userId).single();
    if (!user || !user.totp_secret) throw new Error('2FA setup not initiated');

    const isValid = authenticator.check(code, user.totp_secret);
    if (!isValid) throw new Error('Invalid verification code');

    await supabase.from('users').update({ totp_enabled: true }).eq('id', userId);
    return { success: true };
}

module.exports = { register, login, refreshToken, logout, verifyAccessToken, setup2FA, verifyAndEnable2FA };
