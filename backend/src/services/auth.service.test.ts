import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ===== MOCK FUNCTIONS (must start with 'mock' for Jest hoisting) =====
const mockFindByEmail = jest.fn();
const mockFindByVerificationToken = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockSetVerified = jest.fn();
const mockUpdateVerificationToken = jest.fn();

const mockRefreshSave = jest.fn();
const mockFindByTokenHash = jest.fn();
const mockMarkUsed = jest.fn();
const mockInvalidateFamily = jest.fn();

// ===== MODULE MOCKS =====
jest.mock('../repositories/user.repository', () => ({
  UserRepository: jest.fn().mockImplementation(() => ({
    findByEmail: mockFindByEmail,
    findByVerificationToken: mockFindByVerificationToken,
    findById: mockFindById,
    create: mockCreate,
    setVerified: mockSetVerified,
    updateVerificationToken: mockUpdateVerificationToken,
  })),
}));

jest.mock('../repositories/refresh-token.repository', () => ({
  RefreshTokenRepository: jest.fn().mockImplementation(() => ({
    save: mockRefreshSave,
    findByTokenHash: mockFindByTokenHash,
    markUsed: mockMarkUsed,
    invalidateFamily: mockInvalidateFamily,
  })),
}));

import { AuthService } from './auth.service';
import { UnauthorizedError } from '../shared/errors/app.error';
import { UserRow } from '../shared/types';

// Set required env vars
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-must-be-at-least-32chars';
process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SMTP_FROM = 'test@test.com';

async function makeUserRow(overrides: Partial<UserRow> = {}): Promise<UserRow> {
  return {
    id: 'user-uuid-123',
    email: 'juan@example.com',
    password_hash: await bcrypt.hash('password123', 10),
    role: 'admin',
    verified: true,
    must_change_password: false,
    verification_token: null,
    verification_token_expires: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('AuthService.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lanza UnauthorizedError cuando el usuario no existe', async () => {
    mockFindByEmail.mockResolvedValue(null);

    await expect(
      AuthService.login('noexiste@test.com', 'cualquier'),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('lanza UnauthorizedError cuando el usuario no está verificado', async () => {
    const user = await makeUserRow({ verified: false });
    mockFindByEmail.mockResolvedValue(user);

    await expect(
      AuthService.login('juan@example.com', 'password123'),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('lanza UnauthorizedError cuando el password es incorrecto', async () => {
    const user = await makeUserRow({ verified: true });
    mockFindByEmail.mockResolvedValue(user);

    await expect(
      AuthService.login('juan@example.com', 'password-incorrecto'),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('retorna accessToken con claims correctos en login exitoso', async () => {
    const user = await makeUserRow({ verified: true });
    mockFindByEmail.mockResolvedValue(user);
    mockRefreshSave.mockResolvedValue({
      id: 'rt-uuid',
      token_hash: 'hash',
      user_id: user.id,
      family: 'family-uuid',
      expires_at: new Date(),
      used: false,
      created_at: new Date(),
    });

    const result = await AuthService.login('juan@example.com', 'password123');

    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('juan@example.com');
    expect(result.user.role).toBe('admin');

    const decoded = jwt.decode(result.accessToken) as Record<string, unknown>;
    expect(decoded.sub).toBe(user.id);
    expect(decoded.email).toBe(user.email);
  });
});

describe('AuthService.refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lanza UnauthorizedError si el refresh token ya fue usado (detección de reuso)', async () => {
    const refreshToken = jwt.sign(
      { sub: 'user-id', family: 'family-uuid' },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: '7d' },
    );

    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    mockFindByTokenHash.mockResolvedValue({
      id: 'rt-uuid',
      token_hash: tokenHash,
      user_id: 'user-uuid',
      family: 'family-uuid',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      used: true, // ya fue usado
      created_at: new Date(),
    });
    mockInvalidateFamily.mockResolvedValue(undefined);

    await expect(AuthService.refresh(refreshToken)).rejects.toThrow(UnauthorizedError);
    expect(mockInvalidateFamily).toHaveBeenCalledWith('family-uuid');
  });
});
