import { BaseRepository } from './base.repository';
import { UserRow, UserRole } from '../shared/types';

interface CreateUserData {
  email: string;
  passwordHash: string;
  role?: UserRole;
  verificationToken: string;
  verificationTokenExpires: Date;
}

export class UserRepository extends BaseRepository {
  async findByEmail(email: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );
  }

  async findById(id: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );
  }

  async findByVerificationToken(token: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>(
      'SELECT * FROM users WHERE verification_token = $1',
      [token],
    );
  }

  async create(data: CreateUserData): Promise<UserRow> {
    const rows = await this.query<UserRow>(
      `INSERT INTO users (email, password_hash, role, verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, FALSE, $4, $5)
       RETURNING *`,
      [
        data.email,
        data.passwordHash,
        data.role ?? 'admin',
        data.verificationToken,
        data.verificationTokenExpires,
      ],
    );
    return rows[0];
  }

  async setVerified(userId: string): Promise<void> {
    await this.query(
      `UPDATE users
       SET verified = TRUE, verification_token = NULL, verification_token_expires = NULL
       WHERE id = $1`,
      [userId],
    );
  }

  async updateVerificationToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<void> {
    await this.query(
      `UPDATE users
       SET verification_token = $2, verification_token_expires = $3
       WHERE id = $1`,
      [userId, token, expires],
    );
  }

  async createVerified(data: { email: string; passwordHash: string; role: UserRole }): Promise<{ id: string; email: string; role: UserRole }> {
    const rows = await this.query<{ id: string; email: string; role: UserRole }>(
      `INSERT INTO users (email, password_hash, role, verified, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, TRUE, NULL, NULL)
       RETURNING id, email, role`,
      [data.email, data.passwordHash, data.role],
    );
    return rows[0];
  }

  async findAll(): Promise<UserRow[]> {
    return this.query<UserRow>(
      'SELECT id, email, role, verified, created_at FROM users ORDER BY created_at DESC',
    );
  }
}
