const { ec: EC } = require("elliptic");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { pool } = require("./db");

const ec = new EC("secp256k1");

const SALT_ROUNDS = 10;
const ALGORITHM = "aes-256-cbc";

function generateKeyPair() {
  const keyPair = ec.genKeyPair();
  const publicKey = keyPair.getPublic("hex");
  const privateKey = keyPair.getPrivate("hex");
  const address = crypto.createHash("sha256").update(publicKey).digest("hex");
  return { publicKey, privateKey, address };
}

function encryptPrivateKey(privateKey, password) {
  const key = crypto.scryptSync(password, "ninja-coin-salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptPrivateKey(encryptedData, password) {
  const key = crypto.scryptSync(password, "ninja-coin-salt", 32);
  const [ivHex, encrypted] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function createWallet(password) {
  const { publicKey, privateKey, address } = generateKeyPair();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const encryptedPrivateKey = encryptPrivateKey(privateKey, password);

  await pool.query(
    `INSERT INTO wallets (address, public_key, encrypted_private_key, password_hash, balance, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [address, publicKey, encryptedPrivateKey, passwordHash, 0, Date.now()]
  );

  return { address, balance: 0 };
}

async function getWallet(address) {
  const { rows } = await pool.query(
    "SELECT address, balance FROM wallets WHERE address = $1",
    [address]
  );
  if (rows.length === 0) return null;
  return { address: rows[0].address, balance: Number(rows[0].balance) };
}

async function getPrivateKey(address, password) {
  const { rows } = await pool.query(
    "SELECT password_hash, encrypted_private_key FROM wallets WHERE address = $1",
    [address]
  );
  if (rows.length === 0) return { error: "Wallet not found" };

  const passwordValid = await bcrypt.compare(password, rows[0].password_hash);
  if (!passwordValid) return { error: "Invalid password" };

  try {
    const privateKey = decryptPrivateKey(rows[0].encrypted_private_key, password);
    return { privateKey };
  } catch {
    return { error: "Failed to decrypt private key" };
  }
}

async function verifyPassword(address, password) {
  const { rows } = await pool.query(
    "SELECT public_key, password_hash, encrypted_private_key FROM wallets WHERE address = $1",
    [address]
  );
  if (rows.length === 0) return { valid: false, error: "Wallet not found" };

  const passwordValid = await bcrypt.compare(password, rows[0].password_hash);
  if (!passwordValid) return { valid: false, error: "Invalid password" };

  const privateKey = decryptPrivateKey(rows[0].encrypted_private_key, password);
  return { valid: true, privateKey, publicKey: rows[0].public_key };
}

async function importWallet(privateKeyHex, password) {
  const key = ec.keyFromPrivate(privateKeyHex);
  const publicKey = key.getPublic("hex");
  const address = crypto.createHash("sha256").update(publicKey).digest("hex");

  const { rows } = await pool.query(
    "SELECT balance FROM wallets WHERE address = $1",
    [address]
  );
  if (rows.length === 0) return { error: "Wallet not found" };

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const encryptedPrivateKey = encryptPrivateKey(privateKeyHex, password);

  await pool.query(
    "UPDATE wallets SET password_hash = $1, encrypted_private_key = $2 WHERE address = $3",
    [passwordHash, encryptedPrivateKey, address]
  );

  return { address, balance: Number(rows[0].balance) };
}

async function deleteWallet(address, password) {
  const { rows } = await pool.query(
    "SELECT password_hash FROM wallets WHERE address = $1",
    [address]
  );
  if (rows.length === 0) return { error: "Wallet not found" };

  const passwordValid = await bcrypt.compare(password, rows[0].password_hash);
  if (!passwordValid) return { error: "Invalid password" };

  await pool.query(
    "DELETE FROM transactions WHERE from_address = $1 OR to_address = $1",
    [address]
  );
  await pool.query("DELETE FROM wallets WHERE address = $1", [address]);

  return { message: "Wallet deleted" };
}

module.exports = {
  createWallet,
  getWallet,
  getPrivateKey,
  verifyPassword,
  importWallet,
  deleteWallet,
};
