# Lattic3 - Multi-Collateralized Lending Platform

**Lattic3** is a decentralized lending platform that leverages the asset-oriented Radix Layer 1 blockchain to enable users to collateralize multiple assets for loans.

<div align="center">
<img width="40%" src=https://github.com/user-attachments/assets/51eb3590-b29d-470f-9ceb-bc00bcb40453/>
</div>

This repository contains two primary components: 
- **Scrypto blueprints** for smart contracts.
- **Next.js frontend** with custom shadCN components for user interaction.

[Pitch Deck](https://docs.google.com/presentation/d/1cyRt_FNlBnn0lmo-lSLnMutafHp2g7d_hWwUQlDiL-Q/edit?usp=sharing)

[Demo](youtube.com)

The front-end is available [here](https://radish.on-fleek.app/).

## Features

Radish offers the following key functionalities:
1. **Estimate Loan**: Users can submit up to three different assets as collateral and input their desired amounts. The platform then calculates the amount of Radish stablecoin they would receive if the loan were approved, using Radix blueprints.
2. **Get Loan**: Users can finalize the loan by submitting collateral, allowing them to mint and receive Radish stablecoin in return.
3. **Estimate Withdrawal**: Borrowers can estimate how much collateral they can reclaim by returning a specified amount of Radish tokens.
4. **Withdraw Collateral**: Users can partially or fully withdraw their collateral by repaying Radish stablecoin.

Upon borrowing, users receive a unique **NFT Badge** that tracks their loan statistics. These statistics are also available in the user's dashboard on the frontend.

## Roadmap

- **Stablecoin Backing**: Currently, the Radish stablecoin is not backed by any assets.
- **Liquidation Event**: The platform does not yet have liquidation functionality. A future implementation would involve integrating an oracle and a decentralized exchange (DEX) like OciSwap to automatically liquidate collateral when necessary.

## Vision

We aim to continue developing Radish after the hackathon, pursuing milestone-based grants provided by the Radix team to drive further innovation and feature expansion.
