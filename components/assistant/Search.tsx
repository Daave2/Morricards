
'use client';

import { useEffect, useMemo, useState, useCallback } from "react";
import type { SearchHit } from "@/lib/morrisonsSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, Star, X } from "lucide-react";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  defaultQuery?: string;
  onPick?: (hit: SearchHit) => void;
  onSearch?: (hits: SearchHit[]) => void;
  onClear?: () => void;
};

export default function SearchComponent({ defaultQuery = "", onPick, onSearch, onClear }: Props) {
  const [q, setQ] = useState(defaultQuery);
  const [pendingQ, setPendingQ] = useState(defaultQuery);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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
        if (onSearch) onSearch([]);
        return;
      }
      setShowAll(false); // Reset on new search
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
            if (onSearch) onSearch([]);
          } else {
            const foundHits = Array.isArray(json?.hits) ? json.hits : [];
            setHits(foundHits);
            if (onSearch) onSearch(foundHits);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(String(e?.message ?? e));
          setHits([]);
          if (onSearch) onSearch([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [q, onSearch]);
  
  const handlePick = useCallback((hit: SearchHit) => {
    setQ('');
    setPendingQ('');
    setHits([]);
    if (onPick) {
      onPick(hit);
    }
    if (onSearch) {
      onSearch([]);
    }
  }, [onPick, onSearch]);

  const handleClear = useCallback(() => {
      setQ('');
      setPendingQ('');
      setHits([]);
      setShowAll(false);
      if (onClear) {
        onClear();
      }
      if (onSearch) {
        onSearch([]);
      }
  }, [onClear, onSearch]);

  const visibleHits = useMemo(() => {
    // onSearch callback handles the full list, onPick handles selection.
    // The component itself will only render if `onPick` is provided.
    if (!onPick) return [];
    return showAll ? hits : hits.slice(0, 5);
  }, [hits, showAll, onPick]);


  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={pendingQ}
          onChange={(e) => setPendingQ(e.target.value)}
          placeholder="Search by name, or enter a SKU/EAN..."
          className="pl-10"
        />
         {pendingQ && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={handleClear}>
                <X className="h-4 w-4" />
            </Button>
          )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <Loader2 className="animate-spin" />
            <span>Searching...</span>
        </div>
        )}
      {err && <div className="text-sm text-destructive">Error: {err}</div>}
      
      {visibleHits.length > 0 && (
          <div className="space-y-4">
          {visibleHits.map((h, i) => (
             <Card
                key={`${h.groupType}-${h.retailerProductId}-${h.productId}-${h.title}`}
                className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-shadow animate-in fade-in-50"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => handlePick(h)}
            >
                <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn("rounded-lg p-2", "border theme-glass:border-white/20 theme-glass:bg-white/10 theme-glass:backdrop-blur-xl")}>
                        <Image
                            src={h.image || 'https://placehold.co/100x100.png'}
                            alt={h.title}
                            width={80}
                            height={80}
                            className="rounded-md object-cover"
                            data-ai-hint="product image small"
                        />
                    </div>
                    <div className="flex-grow min-w-0">
                        <p className="font-semibold">{h.title}</p>
                        <p className="text-sm text-muted-foreground">{h.brand || 'Unknown Brand'}</p>
                        {(h.price) && (
                            <div className="mt-2 flex items-baseline gap-2">
                                <Badge variant='secondary'>
                                    {`£${h.price.toFixed(2)}`}
                                </Badge>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
          ))}
        </div>
      )}
      {hits.length > 5 && !showAll && onPick && (
        <Button variant="outline" className="w-full" onClick={() => setShowAll(true)}>
          Show all {hits.length} results
        </Button>
      )}
    </div>
  );
}
