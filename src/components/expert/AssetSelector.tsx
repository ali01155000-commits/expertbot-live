"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatPrice,
  getExpertSocket,
  useExpertStore,
} from "@/lib/expert-store";
import type { Asset } from "@/lib/expert-types";

export default function AssetSelector() {
  const assets = useExpertStore((s) => s.assets) ?? [];
  const selectedAssetId = useExpertStore((s) => s.selectedAssetId);
  const candles = useExpertStore((s) => s.candles) ?? [];
  const currentPrice = useExpertStore((s) => s.currentPrice);
  const setSelectedAsset = useExpertStore((s) => s.setSelectedAsset);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manualId, setManualId] = useState<string>(String(selectedAssetId));

  // Keep manualId input in sync when selection changes (e.g. picked from list)
  useEffect(() => {
    setManualId(String(selectedAssetId));
  }, [selectedAssetId]);

  // % change from first visible candle to current
  const pctChange = useMemo(() => {
    if (candles.length < 2) return 0;
    const first = candles[0].o;
    const last = currentPrice ?? candles[candles.length - 1].c;
    if (!first) return 0;
    return ((last - first) / first) * 100;
  }, [candles, currentPrice]);

  const selectedAsset: Asset | undefined = useMemo(
    () => assets.find((a) => a.id === selectedAssetId),
    [assets, selectedAssetId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => a.name.toLowerCase().includes(q) || String(a.id).includes(q));
  }, [assets, query]);

  const handlePick = (id: number) => {
    setSelectedAsset(id);
    getExpertSocket()?.emit("expert:set-asset", { assetId: id });
    setOpen(false);
    setQuery("");
  };

  const handleManualId = (val: string) => {
    setManualId(val);
    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) {
      setSelectedAsset(num);
      getExpertSocket()?.emit("expert:set-asset", { assetId: num });
    }
  };

  const up = pctChange >= 0;

  return (
    <div className="space-y-3">
      {/* Selected asset header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-black/40 border-white/10 hover:bg-white/5 gap-2 font-semibold"
              >
                <span className="text-zinc-100">
                  {selectedAsset ? selectedAsset.name : `Asset #${selectedAssetId}`}
                </span>
                <ChevronDown className="size-3.5 text-zinc-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-0 bg-[#0a0e14] border-white/10"
              align="start"
            >
              <div className="p-2 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ابحث عن أصل..."
                    className="bg-black/40 border-white/10 text-sm pr-7"
                    autoFocus
                  />
                </div>
              </div>
              <ScrollArea className="h-64">
                <div className="p-1">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-zinc-500">
                      لا توجد أصول. استخدم إدخال ID يدوياً بالأسفل.
                    </div>
                  ) : (
                    filtered.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => handlePick(a.id)}
                        className={`w-full text-right flex items-center justify-between gap-2 rounded px-2.5 py-1.5 text-sm hover:bg-white/5 transition ${
                          a.id === selectedAssetId ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-200"
                        }`}
                      >
                        <span className="truncate">{a.name}</span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          #{a.id}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Badge variant="outline" className="border-white/10 text-zinc-400 font-mono">
            #{selectedAssetId}
          </Badge>
        </div>

        {/* Price */}
        <div className="text-left">
          <div className="font-mono text-lg font-bold text-zinc-100">
            {formatPrice(currentPrice, 5)}
          </div>
          <div
            className={`flex items-center justify-end gap-0.5 text-[11px] font-medium ${
              up ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            <span className="font-mono">
              {up ? "+" : ""}
              {pctChange.toFixed(3)}%
            </span>
          </div>
        </div>
      </div>

      {/* Fallback manual ID input (always available — useful when assets list empty) */}
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
        <span className="text-[11px] text-zinc-500 px-1">معرّف الأصل (يدوي):</span>
        <Input
          value={manualId}
          onChange={(e) => handleManualId(e.target.value)}
          className="h-7 w-24 bg-black/40 border-white/10 font-mono text-sm"
          dir="ltr"
        />
        <span className="text-[10px] text-zinc-600">
          افتراضي: 240 = EUR/USD
        </span>
      </div>
    </div>
  );
}
