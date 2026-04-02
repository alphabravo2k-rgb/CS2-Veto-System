'use strict';

const { register, login, refreshToken } = require('../domain/auth/AuthService');
const supabase = require('../infra/supabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock external dependencies
jest.mock('../infra/supabase');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService Suite — Identity Security & Validation', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test_secret';
    });

    describe('Registration Flow', () => {
        it('should correctly assign platform_admin role to authorized master email', async () => {
            const masterEmail = 'alphabravo2k@gmail.com';
            bcrypt.hash.mockResolvedValue('hashed_pass');
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    or: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({ data: null })
                    })
                }),
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ 
                            data: { id: 'uuid', email: masterEmail, role: 'platform_admin' }, 
                            error: null 
                        })
                    })
                })
            });

            const result = await register({
                email: masterEmail,
                password: 'password123',
                username: 'master',
                dob: '1990-01-01',
                ageConsent: true
            });

            expect(result.role).toBe('platform_admin');
        });

        it('should reject users under the age of 13', async () => {
            const youngDob = new Date();
            youngDob.setFullYear(youngDob.getFullYear() - 10); // 10 years old
            
            await expect(register({
                email: 'kid@example.com',
                password: 'password123',
                username: 'kiddo',
                dob: youngDob.toISOString(),
                ageConsent: true
            })).rejects.toThrow('Must be at least 13 years old');
        });
    });

    describe('Login & Token Security', () => {
        it('should issue signed JWTs on successful authentication', async () => {
            const mockUser = { id: 'u1', password_hash: 'hash', email: 'test@o.com', role: 'player' };
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({ data: mockUser })
                }),
                insert: jest.fn().mockReturnValue({ error: null })
            });
            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('mock_access_token');

            const result = await login('test@o.com', 'password123');
            
            expect(result.accessToken).toBe('mock_access_token');
            expect(result.user.email).toBe('test@o.com');
        });

        it('should reject invalid credentials with 401-style error', async () => {
            supabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    maybeSingle: jest.fn().mockResolvedValue({ data: null })
                })
            });

            await expect(login('wrong@o.com', 'pass')).rejects.toThrow('Invalid credentials');
        });
    });
});
