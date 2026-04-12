import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getWallet, getPrivateKey, getTransactions, deleteWalletApi } from "../api";

function shortAddr(addr) {
  if (!addr || addr.length <= 20) return addr;
  return addr.slice(0, 8) + "..." + addr.slice(-8);
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " at " + d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Wallet() {
  const { address } = useParams();
  const navigate = useNavigate();

  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Private key modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyPassword, setKeyPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [keyLoading, setKeyLoading] = useState(false);

  // Delete wallet modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        getWallet(address),
        getTransactions(address),
      ]);
      setWallet(walletRes.data);
      setTransactions(txRes.data.transactions || []);
      localStorage.setItem("ninja-coin-address", address);
    } catch {
      setError("Wallet not found");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 10 seconds
  const intervalRef = useRef(null);
  useEffect(() => {
    intervalRef.current = setInterval(fetchData, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  function copyAddress() {
    navigator.clipboard.writeText(address);
    toast.success("Copied!", { duration: 2000 });
  }

  async function handleRevealKey(e) {
    e.preventDefault();
    setKeyError("");
    setKeyLoading(true);
    try {
      const res = await getPrivateKey(address, keyPassword);
      setPrivateKey(res.data.privateKey);
    } catch (err) {
      setKeyError(err.response?.data?.error || "Invalid password");
    } finally {
      setKeyLoading(false);
    }
  }

  function closeModal() {
    setShowKeyModal(false);
    setKeyPassword("");
    setPrivateKey("");
    setKeyError("");
  }

  function closeDeleteModal() {
    setShowDeleteModal(false);
    setDeletePassword("");
    setDeleteError("");
  }

  async function handleDelete(e) {
    e.preventDefault();
    setDeleteError("");
    setDeleteLoading(true);
    try {
      await deleteWalletApi(address, deletePassword);
      localStorage.removeItem("ninja-coin-address");
      toast.success("Wallet deleted");
      navigate("/");
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Failed to delete wallet");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="card wallet-card" style={{ textAlign: "center", padding: 40 }}>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card wallet-card" style={{ textAlign: "center" }}>
        <p style={{ color: "var(--danger)", marginBottom: 16 }}>{error}</p>
        <button className="btn btn-outline" onClick={() => navigate("/")}>
          Go Home
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Balance Card */}
      <div className="card wallet-card">
        <div className="balance-display">
          <div className="balance-label">Your Balance</div>
          <div className="balance-row">
            <span className="balance-amount">{wallet.balance}</span>
            <span className="balance-coin">TN</span>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">
            <span style={{ marginRight: 6 }}>Your Address</span>
          </label>
          <div className="address-box">
            <span className="ninja-badge">🥷</span>
            <span className="address-text">{address}</span>
            <button className="copy-btn" onClick={copyAddress} title="Copy address">
              📋
            </button>
          </div>
        </div>

        <div className="btn-group">
          <button className="btn btn-gold" onClick={() => navigate(`/send/${address}`)}>
            Send TN
          </button>
          <button className="btn btn-outline" onClick={() => setShowKeyModal(true)}>
            Show Private Key
          </button>
        </div>

        <button
          className="btn btn-danger"
          style={{ marginTop: 12, width: "100%" }}
          onClick={() => setShowDeleteModal(true)}
        >
          Delete Wallet
        </button>
      </div>

      {/* Transactions */}
      <div className="card">
        <h3 className="card-title" style={{ fontSize: 16 }}>
          Transaction History
        </h3>
        <div className="tx-list">
          {transactions.length === 0 ? (
            <div className="tx-empty">
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>🥷</div>
              No transactions yet
            </div>
          ) : (
            transactions.map((tx) => (
              <div className={`tx-item tx-item-${tx.type}`} key={tx.txId}>
                <div className={`tx-icon ${tx.type}`}>
                  {tx.type === "sent" ? "↑" : "↓"}
                </div>
                <div className="tx-info">
                  <div className={`tx-type ${tx.type}`}>
                    {tx.type === "sent" ? "Sent" : "Received"}
                  </div>
                  <div className="tx-address">
                    {tx.type === "sent"
                      ? `To: ${shortAddr(tx.to)}`
                      : `From: ${shortAddr(tx.from)}`}
                  </div>
                  <div className="tx-date">{formatDate(tx.timestamp)}</div>
                </div>
                <div className={`tx-amount ${tx.type}`}>
                  {tx.type === "sent" ? "-" : "+"}{tx.amount} TN
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Private Key Modal */}
      {showKeyModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {privateKey ? "🔑 Private Key" : "🔒 Enter Password"}
            </h3>

            {!privateKey ? (
              <form onSubmit={handleRevealKey}>
                <div className="input-group">
                  <label>Wallet Password</label>
                  <input
                    type="password"
                    placeholder="Enter your password..."
                    value={keyPassword}
                    onChange={(e) => setKeyPassword(e.target.value)}
                    autoFocus
                  />
                </div>
                {keyError && <p className="error-text">{keyError}</p>}
                <div className="btn-group">
                  <button className="btn btn-outline" type="button" onClick={closeModal}>
                    Cancel
                  </button>
                  <button className="btn btn-gold" type="submit" disabled={keyLoading || !keyPassword}>
                    {keyLoading ? <><span className="spinner" /> Verifying...</> : "Reveal"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="private-key-box">{privateKey}</div>
                <p className="private-key-warning">
                  Never share your private key with anyone.
                </p>
                <button
                  className="btn btn-outline"
                  style={{ marginTop: 14 }}
                  onClick={closeModal}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Wallet Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ color: "var(--danger)" }}>
              Delete Wallet
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
              This action is permanent. All wallet data and transaction history will be deleted.
            </p>
            <form onSubmit={handleDelete}>
              <div className="input-group">
                <label>Enter your password to confirm</label>
                <input
                  type="password"
                  placeholder="Your wallet password..."
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoFocus
                />
              </div>
              {deleteError && <p className="error-text">{deleteError}</p>}
              <div className="btn-group">
                <button className="btn btn-outline" type="button" onClick={closeDeleteModal}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  type="submit"
                  disabled={deleteLoading || !deletePassword}
                >
                  {deleteLoading ? <><span className="spinner" /> Deleting...</> : "Delete Forever"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
