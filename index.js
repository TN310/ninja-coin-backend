const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createWallet, getWallet, getPrivateKey, importWallet, deleteWallet } = require("./wallet");
const { sendCoins, getTransactionHistory, verifyChain } = require("./transaction");
const db = require("./firebase");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Create a new wallet
app.post("/wallet/create", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password is required (min 6 characters)" });
    }

    const wallet = await createWallet(password);
    res.json({
      message: "Wallet created successfully",
      address: wallet.address,
      balance: wallet.balance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wallet info (public)
app.get("/wallet/:address", async (req, res) => {
  try {
    const wallet = await getWallet(req.params.address);
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get private key (requires password)
app.post("/wallet/:address/privatekey", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const result = await getPrivateKey(req.params.address, password);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }

    res.json({ privateKey: result.privateKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import wallet with private key
app.post("/wallet/import", async (req, res) => {
  try {
    const { privateKey, password } = req.body;
    if (!privateKey || !password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Private key and password (min 6 characters) are required" });
    }

    const result = await importWallet(privateKey, password);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: "Wallet imported successfully",
      address: result.address,
      balance: result.balance,
    });
  } catch (err) {
    res.status(500).json({ error: "Invalid private key" });
  }
});

// Delete wallet
app.delete("/wallet/:address", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const result = await deleteWallet(req.params.address, password);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send coins
app.post("/transaction", async (req, res) => {
  try {
    const { fromAddress, password, toAddress, amount } = req.body;
    if (!fromAddress || !password || !toAddress || !amount) {
      return res
        .status(400)
        .json({ error: "fromAddress, password, toAddress, and amount are required" });
    }

    const result = await sendCoins(fromAddress, password, toAddress, Number(amount));
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: "Transaction successful", transaction: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify the entire transaction chain
app.get("/chain/verify", async (req, res) => {
  try {
    const result = await verifyChain();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get transaction history
app.get("/transactions/:address", async (req, res) => {
  try {
    const history = await getTransactionHistory(req.params.address);
    res.json({ address: req.params.address, transactions: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link Minecraft username to wallet address
app.post("/minecraft/linkwallet", async (req, res) => {
  try {
    const { minecraftUsername, walletAddress } = req.body;
    if (!minecraftUsername || !walletAddress) {
      return res.status(400).json({ error: "minecraftUsername and walletAddress are required" });
    }

    const walletSnapshot = await db.ref(`wallets/${walletAddress}`).once("value");
    if (!walletSnapshot.val()) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    await db.ref(`minecraft_links/${minecraftUsername}`).set({
      walletAddress,
      linkedAt: Date.now(),
    });

    res.json({ success: true, walletAddress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Convert MNC to MTN (stored in-game, not in wallet)
app.post("/minecraft/convert", async (req, res) => {
  try {
    const { minecraftUsername, amount } = req.body;
    if (!minecraftUsername || !amount) {
      return res.status(400).json({ error: "minecraftUsername and amount are required" });
    }

    const mtnRef = db.ref(`minecraft_mtn/${minecraftUsername}/balance`);
    const balanceSnapshot = await mtnRef.once("value");
    const currentBalance = balanceSnapshot.val() || 0;
    const newBalance = currentBalance + Number(amount);

    await mtnRef.set(newBalance);

    res.json({ success: true, newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export MTN from Minecraft to linked wallet
app.post("/minecraft/exportwallet", async (req, res) => {
  try {
    const { minecraftUsername, amount } = req.body;
    if (!minecraftUsername || !amount || amount <= 0) {
      return res.status(400).json({ error: "minecraftUsername and positive amount are required" });
    }

    // Check MTN balance
    const mtnRef = db.ref(`minecraft_mtn/${minecraftUsername}/balance`);
    const mtnSnapshot = await mtnRef.once("value");
    const mtnBalance = mtnSnapshot.val() || 0;

    if (mtnBalance < Number(amount)) {
      return res.status(400).json({ error: "Insufficient MTN balance", balance: mtnBalance });
    }

    // Check wallet link
    const linkSnapshot = await db.ref(`minecraft_links/${minecraftUsername}`).once("value");
    const linkData = linkSnapshot.val();
    if (!linkData) {
      return res.status(404).json({ error: "Wallet not linked" });
    }

    // Deduct MTN
    const newMtnBalance = mtnBalance - Number(amount);
    await mtnRef.set(newMtnBalance);

    // Add to wallet balance
    const walletRef = db.ref(`wallets/${linkData.walletAddress}/balance`);
    const walletSnapshot = await walletRef.once("value");
    const walletBalance = walletSnapshot.val() || 0;
    const newWalletBalance = walletBalance + Number(amount);
    await walletRef.set(newWalletBalance);

    res.json({ success: true, newMtnBalance, newWalletBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get MTN balance for a Minecraft player
app.get("/minecraft/mtn/:username", async (req, res) => {
  try {
    const snapshot = await db.ref(`minecraft_mtn/${req.params.username}/balance`).once("value");
    const balance = snapshot.val() || 0;
    res.json({ balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ninja Coin server running on http://localhost:${PORT}`);
});
