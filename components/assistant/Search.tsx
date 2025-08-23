
'use client';

import { useEffect, useMemo, useState } from "react";
import type { SearchHit } from "@/lib/morrisonsSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, Star } from "lucide-react";
import Image from "next/image";
import { Badge } from "../ui/badge";

type Props = {
  defaultQuery?: string;
  onPick?: (hit: SearchHit) => void;
};

export default function SearchComponent({ defaultQuery = "", onPick }: Props) {
  const [q, setQ] = useState(defaultQuery);
  const [pendingQ, setPendingQ] = useState(defaultQuery);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // simple debounce for typing
  useEffect(() => {
    const id = setTimeout(() => setQ(pendingQ), 400);
    return () => clearTimeout(id);
  }, [pendingQ]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!q.trim()) {
        setHits([]);
        setLoading(false);
        setErr(null);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `/api/morrisons/search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!cancelled) {
          if (!res.ok) {
            setErr(json?.error || `HTTP ${res.status}`);
            setHits([]);
          } else {
            setHits(Array.isArray(json?.hits) ? json.hits : []);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(String(e?.message ?? e));
          setHits([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const resultCount = useMemo(() => hits.length, [hits]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={pendingQ}
          onChange={(e) => setPendingQ(e.target.value)}
          placeholder="Search for products by name..."
          className="pl-10"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <Loader2 className="animate-spin" />
            <span>Searching...</span>
        </div>
        )}
      {err && <div className="text-sm text-destructive">Error: {err}</div>}
      
      {hits.length > 0 && (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {hits.map((h) => (
            <Card
              key={`${h.groupType}-${h.retailerProductId}-${h.productId}-${h.title}`}
              className="flex flex-col overflow-hidden"
            >
              <CardContent className="p-3 flex flex-col flex-grow">
                <div className="aspect-square rounded-xl bg-muted/30 grid place-items-center overflow-hidden mb-3">
                  {h.image ? (
                    <Image
                      src={h.image}
                      alt={h.title}
                      width={150}
                      height={150}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{h.brand}</div>
                <h3 className="font-semibold leading-snug flex-grow">{h.title}</h3>
                {h.packSize && <div className="text-sm opacity-80">{h.packSize}</div>}
                
                <div className="flex justify-between items-center mt-1">
                    <div className="font-bold text-lg">
                        {h.price != null ? `£${h.price.toFixed(2)}` : "—"}
                    </div>
                    {h.available === false && <Badge variant="destructive">Unavailable</Badge>}
                </div>
                
                {h.rating != null && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span>{h.rating.toFixed(1)} ({h.ratingCount ?? 0})</span>
                    </div>
                )}
                
                <Button
                  onClick={() => onPick?.(h)}
                  className="mt-3 w-full"
                  size="sm"
                  disabled={!h.retailerProductId}
                >
                  Select
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
