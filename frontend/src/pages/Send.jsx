import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { sendTransaction } from "../api";

export default function Send() {
  const { address } = useParams();
  const navigate = useNavigate();

  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(e) {
    e.preventDefault();
    setError("");

    if (!toAddress.trim()) {
      setError("Recipient address is required");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!password) {
      setError("Password is required to send TN");
      return;
    }

    setLoading(true);
    try {
      await sendTransaction(address, password, toAddress.trim(), Number(amount));
      toast.success(`Sent ${amount} TN successfully!`);
      navigate(`/wallet/${address}`);
    } catch (err) {
      setError(err.response?.data?.error || "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">Send TN</h2>

      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        From: <span style={{ fontFamily: "Courier New, monospace" }}>{address.slice(0, 16)}...{address.slice(-8)}</span>
      </div>

      <form onSubmit={handleSend}>
        <div className="input-group">
          <label>Recipient Address</label>
          <input
            type="text"
            placeholder="Enter recipient's public address..."
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Amount (TN)</label>
          <input
            type="number"
            placeholder="0.00"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your wallet password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button
          className="btn btn-gold"
          type="submit"
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          {loading ? <><span className="spinner" /> Sending...</> : "Send TN"}
        </button>
      </form>

      <button
        className="btn btn-outline"
        style={{ marginTop: 10 }}
        onClick={() => navigate(`/wallet/${address}`)}
      >
        Cancel
      </button>
    </div>
  );
}
