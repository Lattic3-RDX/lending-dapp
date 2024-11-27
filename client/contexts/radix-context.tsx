"use client";
/* ------------------ Imports ----------------- */
import { rdt } from "@/lib/radix";
import { DataRequestBuilder, WalletDataStateAccount } from "@radixdlt/radix-dapp-toolkit";
import React, { useState, useEffect } from "react";

/* ---------------- Definitions --------------- */
// prettier-ignore
export interface RadixContextState {
  accounts:    null | WalletDataStateAccount[],
  // rdt:        null | RadixDappToolkit;
  // gatewayApi: null | GatewayApiClient
}
// prettier-ignore
export interface RadixContextDispatch {
  setAccounts:    React.Dispatch<React.SetStateAction<null | WalletDataStateAccount[]>>,
  // setRdt:        React.Dispatch<React.SetStateAction<null | RadixDappToolkit>>
  // setGatewayApi: React.Dispatch<React.SetStateAction<null | GatewayApiClient>>
}

type ContextProps = RadixContextState & RadixContextDispatch;

/* --------------- Default State -------------- */
const defaultState: RadixContextState = {
  accounts: null,
  // rdt: null,
  // gatewayApi: null,
};
const defaultDispatch: RadixContextDispatch = {
  setAccounts: () => {},
  // setRdt: () => {},
  // setGatewayApi: () => {},
};

const defaultContext: ContextProps = {
  ...defaultState,
  ...defaultDispatch,
};

/* ----------------- Component ---------------- */
export const RadixContext = React.createContext<ContextProps>(defaultContext);

export function RadixProvider({ children }: { children: React.ReactNode }) {
  // State
  const [accounts, setAccounts] = useState<RadixContextState["accounts"]>(null);
  // const [rdt, setRdt] = useState<RadixContextState["rdt"]>(null);
  // const [gatewayApi, setGatewayApi] = useState<RadixContextState["gatewayApi"]>(null);

  // Getting account state
  useEffect(() => {
    if (!rdt) {
      return;
    }

    rdt.walletApi.setRequestData(DataRequestBuilder.accounts().atLeast(1));
    const sub = rdt.walletApi.walletData$.subscribe((walletData) => {
      // setAccounts(walletData.accounts);
      if (accounts != walletData.accounts) {
        console.log("[wallet.tsx] subscription data", walletData);
        setAccounts(walletData.accounts);
      }

      return () => sub.unsubscribe();
    });
  }, [accounts]);

  // Context Provider
  const contextState: RadixContextState = {
    accounts,
    // rdt,
    // gatewayApi
  };
  const contextDispatch: RadixContextDispatch = {
    setAccounts,
    // setRdt,
    // setGatewayApi,
  };

  return <RadixContext.Provider value={{ ...contextState, ...contextDispatch }}>{children}</RadixContext.Provider>;
}
