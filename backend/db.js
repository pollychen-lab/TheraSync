import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

// Managed Postgres providers terminate TLS with their own private certificate
// authority, which Node's default trust store rejects. Pinning that CA keeps
// the connection encrypted *and* verified, instead of the usual shortcut of
// disabling verification altogether. Local Docker Compose leaves
// DATABASE_CA_CERT unset, since Postgres is reachable only on the private
// compose network and speaks plaintext there.
//
// The CA has to be supplied here rather than as an sslmode parameter on
// DATABASE_URL: pg applies the parsed connection string on top of this config,
// so an sslmode in the URL silently discards the pinned CA and verification
// then fails against the system trust store.
function sslConfig() {
  const caPath = process.env.DATABASE_CA_CERT;
  if (!caPath) return false;

  return {
    ca: fs.readFileSync(caPath, 'utf8'),
    rejectUnauthorized: true,
  };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
});
