# Lattic3 - Multi-Collateralized Lending Platform  

**Lattic3** is a decentralized lending platform built on the **Radix blockchain**, allowing users to use multiple assets as collateral for loans. It offers a simple, user-friendly way to access decentralized finance (DeFi).  

[🚀 Live](https://radish.on-fleek.app/)

---

## Features  

- **Multi-Asset Collateral**: Combine multiple assets to maximize your borrowing potential and diversify your portfolio in a single transaction.  
- **NFT Loan Badges**: Track loan stats with unique NFTs visible in the dashboard.  

---

## Front-end: Next.js

1. Clone the repository:  
   ```bash
   git clone https://github.com/Lattic3-RDX/lending-dapp.git
   ```
2. Navigate to the frontend directory:
    ```bash
    cd lending-dapp/client
    ```
3. Install dependencies:
    ```bash
    pnpm install
    ```
4. Start the server:
    ```bash
    pnpm run dev
    ```
    
---

## Back-end: Radix

To set up the backend for **Lattic3**, follow these steps:  

### Prerequisites  

- **Radix Scrypto Toolkit**: Download and install the toolkit from the [Radix Developer Portal](https://developers.radixdlt.com).  
- **Rust**: Ensure Rust is installed. You can download it [here](https://www.rust-lang.org/).  

---

### Steps  

1. Clone the repository:  
   ```bash
   git clone https://github.com/Lattic3-RDX/lending-dapp.git
   ```

2. Navigate to the scrypto directory:
    ```bash
    cd lending-dapp/scrypto
    ```

3. Build the Scrypto project:
    ```bash
    scrypto build
    ```

4. Test the blueprints:
    ```bash
    scrypto test
    ```

5. Deploy to your local Radix environment:
    ```bash
    resim publish .
    ```
Interact with the blueprints using Radix’s REPL commands or integrate them with the frontend.
