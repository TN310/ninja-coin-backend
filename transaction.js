const { ec: EC } = require("elliptic");
const crypto = require("crypto");
const db = require("./firebase");
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
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        timestamp: tx.timestamp,
        signature: tx.signature,
        previousHash: tx.previousHash,
      })
    )
    .digest("hex");
}

const GENESIS_HASH = "0".repeat(64);

async function getLatestTransactionHash() {
  const snapshot = await db.ref("transactions").once("value");
  const allTx = snapshot.val();
  if (!allTx) return GENESIS_HASH;

  let latest = null;
  for (const tx of Object.values(allTx)) {
    if (!latest || tx.timestamp > latest.timestamp) {
      latest = tx;
    }
  }
  return latest ? hashTransaction(latest) : GENESIS_HASH;
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
  const senderSnap = await db.ref(`wallets/${fromAddress}`).once("value");
  const sender = senderSnap.val();
  if (!sender) return { error: "Sender wallet not found" };

  // Get receiver wallet
  const receiverSnap = await db.ref(`wallets/${toAddress}`).once("value");
  const receiver = receiverSnap.val();
  if (!receiver) return { error: "Receiver wallet not found" };

  // Check balance
  if (sender.balance < amount) {
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

  // Update balances
  await db.ref(`wallets/${fromAddress}/balance`).set(sender.balance - amount);
  await db.ref(`wallets/${toAddress}/balance`).set(receiver.balance + amount);

  // Store transaction (with chain hash)
  const txId = crypto.randomBytes(16).toString("hex");
  await db.ref(`transactions/${txId}`).set({
    ...txData,
    signature,
    previousHash,
  });

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
  const snapshot = await db.ref("transactions").once("value");
  const allTx = snapshot.val();
  if (!allTx) return { valid: true, length: 0 };

  const sorted = Object.entries(allTx)
    .map(([txId, tx]) => ({ txId, ...tx }))
    .sort((a, b) => a.timestamp - b.timestamp);

  let expectedPrev = GENESIS_HASH;
  for (const tx of sorted) {
    if (tx.previousHash !== expectedPrev) {
      return { valid: false, brokenAt: tx.txId, length: sorted.length };
    }
    expectedPrev = hashTransaction(tx);
  }
  return { valid: true, length: sorted.length };
}

async function getTransactionHistory(address) {
  const snapshot = await db.ref("transactions").once("value");
  const allTx = snapshot.val();
  if (!allTx) return [];

  const history = Object.entries(allTx)
    .filter(([, tx]) => tx.from === address || tx.to === address)
    .map(([txId, tx]) => ({
      txId,
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      timestamp: tx.timestamp,
      type: tx.from === address ? "sent" : "received",
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  return history;
}

module.exports = { sendCoins, getTransactionHistory, verifyChain };
