import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../shared/errors/app.error';
import { JwtPayload, RefreshTokenPayload, UserRole } from '../shared/types';

const userRepository = new UserRepository();
const refreshTokenRepository = new RefreshTokenRepository();

let mailerTransport: nodemailer.Transporter | null = null;

async function getMailer(): Promise<nodemailer.Transporter> {
  if (mailerTransport) return mailerTransport;

  if (env.SMTP_USER && env.SMTP_PASS) {
    const port = env.SMTP_PORT ?? 465;
    mailerTransport = nodemailer.createTransport({
      host: env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  } else if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    mailerTransport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: env.ETHEREAL_USER, pass: env.ETHEREAL_PASS },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    mailerTransport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('[mailer] Ethereal test account:', testAccount.user);
  }

  return mailerTransport;
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const mailer = await getMailer();
  const verifyUrl = `${env.APP_URL}/verify-email?token=${token}`;

  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'Verificá tu cuenta — GPS Monitor',
    html: `
      <h2>Bienvenido a GPS Monitor</h2>
      <p>Hacé clic en el siguiente enlace para verificar tu cuenta:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>Este enlace expira en 24 horas.</p>
    `,
  });
}

async function sendWelcomeEmail(email: string, password: string): Promise<void> {
  const mailer = await getMailer();
  const loginUrl = `${env.APP_URL}/login`;
  console.log(`[mailer] Sending welcome email to ${email}`);

  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'Tu cuenta en GPS Monitor',
    html: `
      <h2>Bienvenido a GPS Monitor</h2>
      <p>Un administrador creó tu cuenta. Tus credenciales de acceso son:</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Contraseña temporal:</strong> ${password}</li>
      </ul>
      <p>Al ingresar por primera vez, el sistema te pedirá que cambies tu contraseña.</p>
      <p><a href="${loginUrl}">Ingresar a GPS Monitor</a></p>
    `,
  });
  console.log(`[mailer] Welcome email sent to ${email}`);
}

function generateVerificationToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { token, expires };
}

function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

function generateRefreshToken(
  payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
): string {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

export const AuthService = {
  async register(email: string, password: string): Promise<void> {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('El email ya está registrado');
    }

    if (password.length < 8) {
      throw new ValidationError('El password debe tener al menos 8 caracteres');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { token, expires } = generateVerificationToken();

    await userRepository.create({
      email,
      passwordHash,
      verificationToken: token,
      verificationTokenExpires: expires,
    });

    await sendVerificationEmail(email, token);
  },

  async verifyEmail(token: string): Promise<void> {
    const user = await userRepository.findByVerificationToken(token);
    if (!user) {
      throw new ValidationError('Token de verificación inválido');
    }

    if (!user.verification_token_expires || user.verification_token_expires < new Date()) {
      throw new ValidationError('El token de verificación expiró');
    }

    await userRepository.setVerified(user.id);
  },

  async resendVerification(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user || user.verified) {
      return;
    }

    const { token, expires } = generateVerificationToken();
    await userRepository.updateVerificationToken(user.id, token, expires);
    await sendVerificationEmail(email, token);
  },

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: UserRole; mustChangePassword: boolean } }> {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    if (!user.verified) {
      throw new UnauthorizedError('Debés verificar tu email antes de iniciar sesión');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const family = crypto.randomUUID();
    const refreshToken = generateRefreshToken({
      sub: user.id,
      family,
    });

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.save({
      tokenHash,
      userId: user.id,
      family,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password,
      },
    };
  },

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; newRefreshToken: string }> {
    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedError('Refresh token inválido o expirado');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await refreshTokenRepository.findByTokenHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedError('Refresh token no encontrado');
    }

    if (stored.used) {
      await refreshTokenRepository.invalidateFamily(stored.family);
      throw new UnauthorizedError('Refresh token ya fue utilizado. Iniciá sesión nuevamente');
    }

    const user = await userRepository.findById(stored.user_id);

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    await refreshTokenRepository.markUsed(stored.id);

    const newRefreshToken = generateRefreshToken({
      sub: user.id,
      family: stored.family,
    });

    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.save({
      tokenHash: newHash,
      userId: user.id,
      family: stored.family,
      expiresAt,
    });

    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken, newRefreshToken };
  },

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await refreshTokenRepository.findByTokenHash(tokenHash);

    if (!stored) return;

    await refreshTokenRepository.markUsed(stored.id);
    await refreshTokenRepository.invalidateFamily(stored.family);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new UnauthorizedError('Contraseña actual incorrecta');

    if (newPassword.length < 8) throw new ValidationError('La nueva contraseña debe tener al menos 8 caracteres');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userRepository.updatePassword(userId, passwordHash);
  },

  async createUser(
    email: string,
    password: string,
    role: UserRole,
  ): Promise<{ id: string; email: string; role: UserRole }> {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userRepository.createVerified({ email, passwordHash, role });

    // Fire-and-forget — don't block the HTTP response
    sendWelcomeEmail(email, password).catch(err =>
      console.error('[mailer] Failed to send welcome email:', err),
    );

    return user;
  },
};
