import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { createWallet } from "../api";

export default function CreateWallet() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await createWallet(password);
      const { address } = res.data;
      localStorage.setItem("ninja-coin-address", address);
      toast.success("Wallet created!");
      navigate(`/wallet/${address}`);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create wallet");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">Create New Wallet</h2>
      <form onSubmit={handleCreate}>
        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="Choose a strong password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Confirm Password</label>
          <input
            type="password"
            placeholder="Confirm your password..."
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-gold" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? <><span className="spinner" /> Creating...</> : "Create Wallet"}
        </button>
      </form>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, textAlign: "center" }}>
        Remember your password — it's needed to view your private key and send TN.
      </p>
    </div>
  );
}
