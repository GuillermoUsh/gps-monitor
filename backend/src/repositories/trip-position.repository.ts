import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';

interface InsertPositionInput {
  tripId:     string;
  lat:        number;
  lng:        number;
  speedKmh?:  number;
  recordedAt: Date;
}

export class TripPositionRepository extends BaseRepository {
  async insert(input: InsertPositionInput, client: PoolClient): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO trip_positions (trip_id, lat, lng, position, speed_kmh, recorded_at)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4, $5)
       RETURNING id`,
      [input.tripId, input.lat, input.lng, input.speedKmh ?? null, input.recordedAt],
    );
    return result.rows[0];
  }

  async findLatestPerActiveTrip(): Promise<
    Array<{ tripId: string; lat: number; lng: number; isDeviation: boolean }>
  > {
    const result = await this.query<{
      trip_id: string;
      lat: number;
      lng: number;
      is_deviation: boolean;
    }>(
      `SELECT DISTINCT ON (tp.trip_id)
         tp.trip_id, tp.lat, tp.lng, tp.is_deviation
       FROM trip_positions tp
       JOIN trips t ON t.id = tp.trip_id
       WHERE t.status = 'active'
       ORDER BY tp.trip_id, tp.recorded_at DESC`,
    );
    return result.map(r => ({
      tripId:      r.trip_id,
      lat:         r.lat,
      lng:         r.lng,
      isDeviation: r.is_deviation,
    }));
  }

  async findPreviousByTrip(
    tripId: string,
    client: PoolClient,
  ): Promise<{ lat: number; lng: number } | null> {
    const result = await client.query<{ lat: number; lng: number }>(
      `SELECT lat, lng FROM trip_positions
       WHERE trip_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1 OFFSET 1`,
      [tripId],
    );
    return result.rows[0] ?? null;
  }

  async updateDeviation(
    id: string,
    isDeviation: boolean,
    deviationMeters: number,
    client: PoolClient,
  ): Promise<void> {
    await client.query(
      `UPDATE trip_positions
       SET is_deviation = $2, deviation_meters = $3
       WHERE id = $1`,
      [id, isDeviation, deviationMeters],
    );
  }
}
