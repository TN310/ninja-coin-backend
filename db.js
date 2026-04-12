const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com")
    ? { rejectUnauthorized: false }
    : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      address TEXT PRIMARY KEY,
      public_key TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      balance NUMERIC DEFAULT 0,
      created_at BIGINT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      tx_id TEXT PRIMARY KEY,
      from_address TEXT,
      to_address TEXT,
      amount NUMERIC,
      timestamp BIGINT,
      signature TEXT,
      previous_hash TEXT,
      hash TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS minecraft_links (
      minecraft_username TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS minecraft_mtn (
      minecraft_username TEXT PRIMARY KEY,
      balance NUMERIC DEFAULT 0
    )
  `);

  console.log("Database tables initialized");
}

module.exports = { pool, initDB };
