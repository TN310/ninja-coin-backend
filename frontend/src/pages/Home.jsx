import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { importWallet } from "../api";

export default function Home() {
  const navigate = useNavigate();

  // Import wallet state
  const [showImport, setShowImport] = useState(false);
  const [importKey, setImportKey] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importConfirm, setImportConfirm] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");

  const savedAddress = localStorage.getItem("ninja-coin-address");

  async function handleImport(e) {
    e.preventDefault();
    setImportError("");

    if (!importKey.trim()) {
      setImportError("Private key is required");
      return;
    }
    if (importPassword.length < 6) {
      setImportError("Password must be at least 6 characters");
      return;
    }
    if (importPassword !== importConfirm) {
      setImportError("Passwords do not match");
      return;
    }

    setImportLoading(true);
    try {
      const res = await importWallet(importKey.trim(), importPassword);
      const { address: addr } = res.data;
      localStorage.setItem("ninja-coin-address", addr);
      toast.success("Wallet imported!");
      navigate(`/wallet/${addr}`);
    } catch (err) {
      setImportError(err.response?.data?.error || "Failed to import wallet");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <>
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>TN</div>
        <h2 className="card-title" style={{ marginBottom: 8 }}>
          Welcome to Ninja Coin
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
          Create a wallet to start sending and receiving TN
        </p>
        <button className="btn btn-gold" onClick={() => navigate("/create")}>
          Create New Wallet
        </button>
      </div>

      {savedAddress && (
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
            Last used wallet
          </p>
          <button
            className="btn btn-outline"
            onClick={() => navigate(`/wallet/${savedAddress}`)}
          >
            Open My Wallet
          </button>
        </div>
      )}

      <div className="divider">or</div>

      <div className="card">
        <p className="card-title" style={{ fontSize: 16 }}>
          Import with Private Key
        </p>
        {!showImport ? (
          <button className="btn btn-outline" onClick={() => setShowImport(true)}>
            Import Wallet
          </button>
        ) : (
          <form onSubmit={handleImport}>
            <div className="input-group">
              <label>Private Key</label>
              <input
                type="password"
                placeholder="Enter your private key..."
                value={importKey}
                onChange={(e) => setImportKey(e.target.value)}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>New Password</label>
              <input
                type="password"
                placeholder="Choose a new password..."
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm your new password..."
                value={importConfirm}
                onChange={(e) => setImportConfirm(e.target.value)}
              />
            </div>
            {importError && <p className="error-text">{importError}</p>}
            <button
              className="btn btn-gold"
              type="submit"
              disabled={importLoading}
              style={{ marginTop: 8 }}
            >
              {importLoading ? <><span className="spinner" /> Importing...</> : "Import Wallet"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
