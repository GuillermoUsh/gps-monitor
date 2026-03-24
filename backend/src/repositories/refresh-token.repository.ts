import { BaseRepository } from './base.repository';
import { RefreshTokenRow } from '../shared/types';

interface SaveRefreshTokenData {
  tokenHash: string;
  userId: string;
  family: string;
  expiresAt: Date;
}

export class RefreshTokenRepository extends BaseRepository {
  async save(data: SaveRefreshTokenData): Promise<RefreshTokenRow> {
    const rows = await this.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens
         (token_hash, user_id, family, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.tokenHash, data.userId, data.family, data.expiresAt],
    );
    return rows[0];
  }

  async findByTokenHash(hash: string): Promise<RefreshTokenRow | null> {
    return this.queryOne<RefreshTokenRow>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [hash],
    );
  }

  async markUsed(id: string): Promise<void> {
    await this.query(
      'UPDATE refresh_tokens SET used = TRUE WHERE id = $1',
      [id],
    );
  }

  async invalidateFamily(family: string): Promise<void> {
    await this.query(
      'UPDATE refresh_tokens SET used = TRUE WHERE family = $1',
      [family],
    );
  }

  async deleteExpired(): Promise<void> {
    await this.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()',
    );
  }
}
