import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";
import Home from "./pages/Home";
import CreateWallet from "./pages/CreateWallet";
import Wallet from "./pages/Wallet";
import Send from "./pages/Send";

function Header() {
  const navigate = useNavigate();
  return (
    <div className="header" onClick={() => navigate("/")}>
      <div className="logo">
        <span className="coin-icon">🥷</span>
        <span className="gold">Ninja</span> Coin
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="app-container">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateWallet />} />
        <Route path="/wallet/:address" element={<Wallet />} />
        <Route path="/send/:address" element={<Send />} />
      </Routes>
    </div>
  );
}

export default App;
