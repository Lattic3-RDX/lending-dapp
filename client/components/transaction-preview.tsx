import { useTransactionPreview } from "@/lib/transaction";
import { useState, useEffect } from "react";
import { LoadingSpinner } from "./ui/loading-spinner";

interface TransactionPreviewProps {
  manifest: string;
}

export function TransactionPreview({ manifest }: TransactionPreviewProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const { getPreview } = useTransactionPreview();

  useEffect(() => {
    const previewTransaction = async () => {
      if (!manifest) return;
      
      setStatus("loading");
      setError(null);
      
      try {
        const preview = await getPreview(manifest);
        console.log("Preview result:", preview);
        setStatus("success");
      } catch (err) {
        console.error("Preview error:", err);
        setError(err instanceof Error ? err.message : "Preview failed");
        setStatus("error");
      }
    };

    previewTransaction();
  }, [manifest]);

  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-2 text-sm h-6">
      {status === "loading" && (
        <>
          <LoadingSpinner className="h-4 w-4 shrink-0" />
          <span className="text-muted-foreground truncate">Transaction preview in progress...</span>
        </>
      )}
      {status === "success" && (
        <span className="text-green-500">Preview successful</span>
      )}
      {status === "error" && (
        <span className="text-destructive truncate">Preview failed: {error}</span>
      )}
    </div>
  );
} 