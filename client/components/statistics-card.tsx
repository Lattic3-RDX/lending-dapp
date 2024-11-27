import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface StatisticsCardProps {
  healthRatio: number;
  netWorth: number;
  netAPR: number;
  isLoading: boolean;
}

export function StatisticsCard({ healthRatio, netWorth, netAPR, isLoading }: StatisticsCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formattedHealthRatio = healthRatio === -1 || healthRatio === Infinity ? '∞' : healthRatio.toFixed(2);

  if (isLoading) {
    return (
      <Card className="bg-background/50 backdrop-blur-sm">
        <CardContent className="flex justify-center items-center min-h-[160px]">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Health Ratio Card */}
          <div className="flex flex-col p-4 rounded-xl bg-background border border-accent/20">
            <div className="text-sm font-medium text-foreground mb-3">
              Health Ratio
            </div>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-foreground">
                {formattedHealthRatio}
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                healthRatio < 1.5 && healthRatio !== -1 && healthRatio !== Infinity
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {healthRatio < 1.5 ? 'At Risk' : 'Safe'}
              </span>
            </div>
          </div>

          {/* Net Worth Card */}
          <div className="flex flex-col p-4 rounded-xl bg-background border border-accent/20">
            <div className="text-sm font-medium text-foreground mb-3">
              Net Worth
            </div>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(netWorth)}
              </div>
              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                USD
              </span>
            </div>
          </div>

          {/* Net APR Card */}
          <div className="flex flex-col p-4 rounded-xl bg-background border border-accent/20">
            <div className="text-sm font-medium text-foreground mb-3">
              Net APR
            </div>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-foreground">
                {netAPR.toFixed(1)}%
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                netAPR > 0 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {netAPR > 0 ? 'Earning' : 'Paying'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default StatisticsCard;