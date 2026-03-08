import { neon } from "@neondatabase/serverless";

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}

export async function initSchema() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS recovery (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      score INTEGER,
      hrv REAL,
      rhr INTEGER,
      spo2 REAL,
      skin_temp_celsius REAL,
      user_calibrating BOOLEAN DEFAULT false,
      raw JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sleep (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      total_in_bed_hours REAL,
      total_awake_hours REAL,
      total_light_hours REAL,
      total_rem_hours REAL,
      total_deep_hours REAL,
      sleep_cycle_count INTEGER,
      disturbance_count INTEGER,
      efficiency REAL,
      respiratory_rate REAL,
      sleep_performance REAL,
      sleep_consistency REAL,
      nap BOOLEAN DEFAULT false,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      raw JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cycle (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      strain REAL,
      calories INTEGER,
      avg_hr INTEGER,
      max_hr INTEGER,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      raw JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workout (
      id SERIAL PRIMARY KEY,
      whoop_id TEXT UNIQUE,
      date DATE NOT NULL,
      sport TEXT,
      strain REAL,
      avg_hr INTEGER,
      max_hr INTEGER,
      calories INTEGER,
      duration_minutes INTEGER,
      distance_meters REAL,
      altitude_gain_meters REAL,
      zones JSONB,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      raw JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS body_measurement (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      height_meters REAL,
      weight_kg REAL,
      max_heart_rate INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      records_synced INTEGER DEFAULT 0,
      error TEXT
    )
  `;
}
