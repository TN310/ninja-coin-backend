import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  headers: { "Content-Type": "application/json" },
});

export function createWallet(password) {
  return api.post("/wallet/create", { password });
}

export function getWallet(address) {
  return api.get(`/wallet/${address}`);
}

export function getPrivateKey(address, password) {
  return api.post(`/wallet/${address}/privatekey`, { password });
}

export function sendTransaction(fromAddress, password, toAddress, amount) {
  return api.post("/transaction", { fromAddress, password, toAddress, amount });
}

export function getTransactions(address) {
  return api.get(`/transactions/${address}`);
}

export function importWallet(privateKey, password) {
  return api.post("/wallet/import", { privateKey, password });
}

export function deleteWalletApi(address, password) {
  return api.delete(`/wallet/${address}`, { data: { password } });
}

export function burnCoins(address, password, amount) {
  return api.post("/wallet/burn", { address, password, amount });
}
