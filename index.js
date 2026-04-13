const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { initDB, pool } = require("./db");
const { createWallet, getWallet, getPrivateKey, importWallet, deleteWallet } = require("./wallet");
const { sendCoins, getTransactionHistory, verifyChain, burnCoins } = require("./transaction");

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

// Burn coins
app.post("/wallet/burn", async (req, res) => {
  try {
    const { address, password, amount } = req.body;
    if (!address || !password || !amount) {
      return res.status(400).json({ error: "address, password, and amount are required" });
    }

    const result = await burnCoins(address, password, Number(amount));
    if (result.error) {
      return res.status(400).json({ error: result.error });
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

    const wallet = await getWallet(walletAddress);
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    await pool.query(
      `INSERT INTO minecraft_links (minecraft_username, wallet_address)
       VALUES ($1, $2)
       ON CONFLICT (minecraft_username) DO UPDATE SET wallet_address = $2`,
      [minecraftUsername, walletAddress]
    );

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

    await pool.query(
      `INSERT INTO minecraft_mtn (minecraft_username, balance)
       VALUES ($1, $2)
       ON CONFLICT (minecraft_username) DO UPDATE SET balance = minecraft_mtn.balance + $2`,
      [minecraftUsername, Number(amount)]
    );

    const { rows } = await pool.query(
      "SELECT balance FROM minecraft_mtn WHERE minecraft_username = $1",
      [minecraftUsername]
    );

    res.json({ success: true, newBalance: Number(rows[0].balance) });
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
    const mtnRes = await pool.query(
      "SELECT balance FROM minecraft_mtn WHERE minecraft_username = $1",
      [minecraftUsername]
    );
    const mtnBalance = mtnRes.rows.length > 0 ? Number(mtnRes.rows[0].balance) : 0;

    if (mtnBalance < Number(amount)) {
      return res.status(400).json({ error: "Insufficient MTN balance", balance: mtnBalance });
    }

    // Check wallet link
    const linkRes = await pool.query(
      "SELECT wallet_address FROM minecraft_links WHERE minecraft_username = $1",
      [minecraftUsername]
    );
    if (linkRes.rows.length === 0) {
      return res.status(404).json({ error: "Wallet not linked" });
    }
    const walletAddress = linkRes.rows[0].wallet_address;

    // Deduct MTN
    const newMtnBalance = mtnBalance - Number(amount);
    await pool.query(
      "UPDATE minecraft_mtn SET balance = $1 WHERE minecraft_username = $2",
      [newMtnBalance, minecraftUsername]
    );

    // Add to wallet balance
    const walletRes = await pool.query(
      "SELECT balance FROM wallets WHERE address = $1",
      [walletAddress]
    );
    const newWalletBalance = Number(walletRes.rows[0].balance) + Number(amount);
    await pool.query("UPDATE wallets SET balance = $1 WHERE address = $2", [
      newWalletBalance,
      walletAddress,
    ]);

    res.json({ success: true, newMtnBalance, newWalletBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset MTN balance for a Minecraft player
app.post("/minecraft/mtn/reset", async (req, res) => {
  try {
    const { minecraftUsername, balance } = req.body;
    if (!minecraftUsername) {
      return res.status(400).json({ error: "minecraftUsername is required" });
    }

    const newBalance = Number(balance) || 0;

    await pool.query(
      `INSERT INTO minecraft_mtn (minecraft_username, balance)
       VALUES ($1, $2)
       ON CONFLICT (minecraft_username) DO UPDATE SET balance = $2`,
      [minecraftUsername, newBalance]
    );

    res.json({ success: true, balance: newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get MTN balance for a Minecraft player
app.get("/minecraft/mtn/:username", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT balance FROM minecraft_mtn WHERE minecraft_username = $1",
      [req.params.username]
    );
    const balance = rows.length > 0 ? Number(rows[0].balance) : 0;
    res.json({ balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize DB tables, then start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Ninja Coin server running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to initialize database:", err.message);
  process.exit(1);
});
