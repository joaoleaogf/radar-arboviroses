import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface AppUser {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  google_id: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  email_verified: boolean;
  created_at: string;
  last_login: string | null;
}
