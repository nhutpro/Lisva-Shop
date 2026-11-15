import { formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  price: number;
  compareAtPrice?: number | null;
  /** Show the "from" label because variants have different prices. */
  from?: boolean;
  fromLabel: string;
  className?: string;
};

export function Price({ price, compareAtPrice, from, fromLabel, className }: Props) {
  const onSale = compareAtPrice != null && compareAtPrice > price;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 tabular-nums", className)}>
      {from && <span className="text-sm font-normal text-muted-foreground">{fromLabel}</span>}
      <span className="font-semibold">{formatVnd(price)}</span>
      {onSale && (
        <s className="text-sm font-normal text-muted-foreground">{formatVnd(compareAtPrice)}</s>
      )}
    </p>
  );
}
