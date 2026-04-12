const { ec: EC } = require("elliptic");
const crypto = require("crypto");
const { pool } = require("./db");
const { verifyPassword } = require("./wallet");

const ec = new EC("secp256k1");

function signTransaction(privateKey, txData) {
  const key = ec.keyFromPrivate(privateKey);
  const txHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(txData))
    .digest("hex");
  const signature = key.sign(txHash);
  return signature.toDER("hex");
}

function verifySignature(publicKey, txData, signature) {
  const key = ec.keyFromPublic(publicKey, "hex");
  const txHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(txData))
    .digest("hex");
  return key.verify(txHash, signature);
}

function hashTransaction(tx) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        from: tx.from_address,
        to: tx.to_address,
        amount: tx.amount,
        timestamp: tx.timestamp,
        signature: tx.signature,
        previousHash: tx.previous_hash,
      })
    )
    .digest("hex");
}

const GENESIS_HASH = "0".repeat(64);

async function getLatestTransactionHash() {
  const { rows } = await pool.query(
    "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 1"
  );
  if (rows.length === 0) return GENESIS_HASH;
  return hashTransaction(rows[0]);
}

async function sendCoins(fromAddress, password, toAddress, amount) {
  if (fromAddress === toAddress) {
    return { error: "Cannot send coins to yourself" };
  }

  if (amount <= 0) {
    return { error: "Amount must be greater than 0" };
  }

  // Verify password and get private key
  const auth = await verifyPassword(fromAddress, password);
  if (!auth.valid) {
    return { error: auth.error };
  }

  // Get sender wallet
  const senderRes = await pool.query(
    "SELECT balance FROM wallets WHERE address = $1",
    [fromAddress]
  );
  if (senderRes.rows.length === 0) return { error: "Sender wallet not found" };
  const senderBalance = Number(senderRes.rows[0].balance);

  // Get receiver wallet
  const receiverRes = await pool.query(
    "SELECT balance FROM wallets WHERE address = $1",
    [toAddress]
  );
  if (receiverRes.rows.length === 0) return { error: "Receiver wallet not found" };
  const receiverBalance = Number(receiverRes.rows[0].balance);

  // Check balance
  if (senderBalance < amount) {
    return { error: "Insufficient balance" };
  }

  // Create and sign transaction
  const txData = {
    from: fromAddress,
    to: toAddress,
    amount,
    timestamp: Date.now(),
  };

  const signature = signTransaction(auth.privateKey, txData);

  // Verify signature before committing
  const isValid = verifySignature(auth.publicKey, txData, signature);
  if (!isValid) {
    return { error: "Transaction signature verification failed" };
  }

  // Get hash of latest transaction to chain onto
  const previousHash = await getLatestTransactionHash();

  // Compute this transaction's hash
  const txForHash = {
    from_address: fromAddress,
    to_address: toAddress,
    amount,
    timestamp: txData.timestamp,
    signature,
    previous_hash: previousHash,
  };
  const txHash = hashTransaction(txForHash);

  // Update balances
  await pool.query("UPDATE wallets SET balance = $1 WHERE address = $2", [
    senderBalance - amount,
    fromAddress,
  ]);
  await pool.query("UPDATE wallets SET balance = $1 WHERE address = $2", [
    receiverBalance + amount,
    toAddress,
  ]);

  // Store transaction
  const txId = crypto.randomBytes(16).toString("hex");
  await pool.query(
    `INSERT INTO transactions (tx_id, from_address, to_address, amount, timestamp, signature, previous_hash, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [txId, fromAddress, toAddress, amount, txData.timestamp, signature, previousHash, txHash]
  );

  return {
    txId,
    from: fromAddress,
    to: toAddress,
    amount,
    timestamp: txData.timestamp,
    previousHash,
  };
}

async function verifyChain() {
  const { rows } = await pool.query(
    "SELECT * FROM transactions ORDER BY timestamp ASC"
  );
  if (rows.length === 0) return { valid: true, length: 0 };

  let expectedPrev = GENESIS_HASH;
  for (const tx of rows) {
    if (tx.previous_hash !== expectedPrev) {
      return { valid: false, brokenAt: tx.tx_id, length: rows.length };
    }
    expectedPrev = hashTransaction(tx);
  }
  return { valid: true, length: rows.length };
}

async function getTransactionHistory(address) {
  const { rows } = await pool.query(
    `SELECT tx_id, from_address, to_address, amount, timestamp
     FROM transactions
     WHERE from_address = $1 OR to_address = $1
     ORDER BY timestamp DESC`,
    [address]
  );

  return rows.map((tx) => ({
    txId: tx.tx_id,
    from: tx.from_address,
    to: tx.to_address,
    amount: Number(tx.amount),
    timestamp: Number(tx.timestamp),
    type: tx.from_address === address ? "sent" : "received",
  }));
}

module.exports = { sendCoins, getTransactionHistory, verifyChain };
