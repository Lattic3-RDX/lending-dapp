"use client";
/* ------------------ Imports ----------------- */
import { BackgroundEffects } from "@/components/background-effects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRadixContext } from "@/contexts/provider";
import { gatewayApi } from "@/lib/radix";
import { useEffect, useState } from "react";
import config from "@/lib/config.json";
import { assetConfigs } from "@/types/asset";

/* ------------------- Page ------------------- */
export default function Admin() {
  /* ------------------- State ------------------ */
  const { accounts } = useRadixContext();
  const [hasOwnerBadge, setHasOwnerBadge] = useState<boolean>(false);
  const [ownerBadgeAccount, setOwnerBadgeAccount] = useState<string | null>(null);

  const [clusterData, setClusterData] = useState<any>({});

  /* ----------------- Functions ---------------- */
  const getAccountState = async () => {
    if (!accounts || !gatewayApi) return;

    for (const account of accounts) {
      const accountVaults = await gatewayApi.state.getEntityDetailsVaultAggregated(account.address);
      const _hasOwnerBadge = !!accountVaults.fungible_resources.items.find(
        (asset: { resource_address: string }) => asset.resource_address === config.ownerBadgeAddr,
      );

      if (_hasOwnerBadge) {
        setHasOwnerBadge(true);
        setOwnerBadgeAccount(account.address);
      }
    }
  };

  const getClusterState = async () => {
    if (!accounts || !gatewayApi) return;

    const cluster_res = await fetch("/api/assets/clusters", { method: "GET" });
    const clusters = await cluster_res.json();

    setClusterData(clusters);
  };

  const getAssetEntry = (address: string) => {
    return Object.values(assetConfigs).find((value) => value.address === address);
  };

  /* ------------------- Hooks ------------------ */
  useEffect(() => {
    if (!accounts || !gatewayApi) return;

    getAccountState();
    getClusterState();
  }, [accounts]);

  /* -------------------- TSX ------------------- */
  return (
    <div className="relative min-h-screen">
      <BackgroundEffects />
      <main className="flex min-h-screen flex-col p-8">
        <div className="container mx-auto space-y-4">
          {/* Title */}
          <div className="flex flex-col space-y-1.5 mb-6">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">Lattic3 Admin Page</h1>
          </div>

          {/* Content */}
          {hasOwnerBadge && (
            <Card>
              <CardHeader>
                <CardTitle>Clusters</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col space-y-4">
                {Object.keys(clusterData).map((clusterResource: string) => (
                  <Card key={clusterResource}>
                    <CardHeader>
                      <CardTitle>{getAssetEntry(clusterResource)?.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="table-fixed border-separate border-spacing-y-1 border-spacing-x-4">
                        <tr className="font-lg">
                          <td className="font-semibold">Resource Address</td>
                          <td>{clusterResource}</td>
                        </tr>
                        <tr className="font-lg">
                          <td className="font-semibold">Liquidity</td>
                          <td>{clusterData[clusterResource].liquidity}</td>
                        </tr>
                        <tr className="font-lg">
                          <td className="font-semibold">Supply</td>
                          <td>{clusterData[clusterResource].supply}</td>
                        </tr>
                        <tr className="font-lg">
                          <td className="font-semibold">Debt</td>
                          <td>{clusterData[clusterResource].debt}</td>
                        </tr>
                      </table>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
