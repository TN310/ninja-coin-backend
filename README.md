# Ninja Coin

A crypto-like wallet system with REST API.

## Setup

```bash
npm install
```

You need a Firebase service account key. Download it from the Firebase Console and save it as `serviceAccountKey.json` in the project root, then set the environment variable:

```
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

## Run

```bash
npm start
```

Server runs on `http://localhost:3000`.

## API Endpoints

### Create Wallet

```bash
curl -X POST http://localhost:3000/wallet/create \
  -H "Content-Type: application/json" \
  -d '{"password": "mypassword123"}'
```

Returns: `{ address, balance: 100 }`

### Get Wallet Balance

```bash
curl http://localhost:3000/wallet/<address>
```

Returns: `{ address, balance }`

### View Private Key (requires password)

```bash
curl -X POST http://localhost:3000/wallet/<address>/privatekey \
  -H "Content-Type: application/json" \
  -d '{"password": "mypassword123"}'
```

Returns: `{ privateKey }` — only if password is correct.

### Send Coins

```bash
curl -X POST http://localhost:3000/transaction \
  -H "Content-Type: application/json" \
  -d '{"fromAddress": "<sender>", "password": "mypassword123", "toAddress": "<receiver>", "amount": 25}'
```

### Transaction History

```bash
curl http://localhost:3000/transactions/<address>
```

Returns all sent and received transactions for the wallet.

## Security

- Passwords are hashed with bcrypt (never stored in plain text)
- Private keys are encrypted with AES-256-CBC using the wallet password
- Transactions are signed with secp256k1 (same as Bitcoin)
- Private keys are only revealed after password verification
