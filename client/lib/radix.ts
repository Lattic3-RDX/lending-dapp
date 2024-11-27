import { GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";
import { RadixDappToolkit, RadixNetwork } from "@radixdlt/radix-dapp-toolkit";
import { definitionAddress } from "./utils";

let rdt: ReturnType<typeof RadixDappToolkit> | null = null;
let gatewayApi: GatewayApiClient | null = null;

if (typeof window !== "undefined") {
  rdt = RadixDappToolkit({
    dAppDefinitionAddress: definitionAddress,
    networkId: RadixNetwork.Stokenet,
    applicationName: "Lattic3",
    applicationVersion: "1.0.0",
  });

  if (rdt) {
    rdt.buttonApi.setTheme("white-with-outline");
    rdt.buttonApi.setMode("light");
    gatewayApi = GatewayApiClient.initialize(rdt.gatewayApi.clientConfig);
  }
}

export { rdt, gatewayApi };
