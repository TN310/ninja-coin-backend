const { ec: EC } = require("elliptic");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const db = require("./firebase");

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

  await db.ref(`wallets/${address}`).set({
    publicKey,
    balance: 0,
    passwordHash,
    encryptedPrivateKey,
    createdAt: Date.now(),
  });

  return { address, balance: 0 };
}

async function getWallet(address) {
  const snapshot = await db.ref(`wallets/${address}`).once("value");
  const data = snapshot.val();
  if (!data) return null;
  return { address, balance: data.balance };
}

async function getPrivateKey(address, password) {
  const snapshot = await db.ref(`wallets/${address}`).once("value");
  const data = snapshot.val();
  if (!data) return { error: "Wallet not found" };

  const passwordValid = await bcrypt.compare(password, data.passwordHash);
  if (!passwordValid) return { error: "Invalid password" };

  try {
    const privateKey = decryptPrivateKey(data.encryptedPrivateKey, password);
    return { privateKey };
  } catch {
    return { error: "Failed to decrypt private key" };
  }
}

async function verifyPassword(address, password) {
  const snapshot = await db.ref(`wallets/${address}`).once("value");
  const data = snapshot.val();
  if (!data) return { valid: false, error: "Wallet not found" };

  const passwordValid = await bcrypt.compare(password, data.passwordHash);
  if (!passwordValid) return { valid: false, error: "Invalid password" };

  const privateKey = decryptPrivateKey(data.encryptedPrivateKey, password);
  return { valid: true, privateKey, publicKey: data.publicKey };
}

async function importWallet(privateKeyHex, password) {
  const key = ec.keyFromPrivate(privateKeyHex);
  const publicKey = key.getPublic("hex");
  const address = crypto.createHash("sha256").update(publicKey).digest("hex");

  const snapshot = await db.ref(`wallets/${address}`).once("value");
  const data = snapshot.val();
  if (!data) return { error: "Wallet not found" };

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const encryptedPrivateKey = encryptPrivateKey(privateKeyHex, password);

  await db.ref(`wallets/${address}`).update({
    passwordHash,
    encryptedPrivateKey,
  });

  return { address, balance: data.balance };
}

async function deleteWallet(address, password) {
  const snapshot = await db.ref(`wallets/${address}`).once("value");
  const data = snapshot.val();
  if (!data) return { error: "Wallet not found" };

  const passwordValid = await bcrypt.compare(password, data.passwordHash);
  if (!passwordValid) return { error: "Invalid password" };

  await db.ref(`wallets/${address}`).remove();

  const txSnapshot = await db.ref("transactions").once("value");
  const allTx = txSnapshot.val();
  if (allTx) {
    const updates = {};
    for (const [txId, tx] of Object.entries(allTx)) {
      if (tx.from === address || tx.to === address) {
        updates[`transactions/${txId}`] = null;
      }
    }
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  }

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
