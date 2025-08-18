
'use client';

import { useMemo } from "react";
import { storeLayout } from "@/lib/map-data";

export interface ProductLocation {
  aisle: string;
  bay: string;
  side: 'Left' | 'Right';
}

interface StoreMapProps {
  productLocation?: ProductLocation | null;
}

const StoreMap = ({ productLocation }: StoreMapProps) => {
    const { meta, aisles, layout } = storeLayout;

    const itemPosition = useMemo(() => {
        if (!productLocation) return null;

        const aisleId = productLocation.aisle.replace(/^0+/, ''); // "01" -> "1"
        const aisleData = aisles.find(a => a.id === aisleId);
        if (!aisleData) return null;

        const bayNum = parseInt(productLocation.bay, 10);
        if (isNaN(bayNum)) return null;

        const [x1, y1] = aisleData.p1;
        const [x2, y2] = aisleData.p2;

        const isVertical = Math.abs(x1 - x2) < Math.abs(y1 - y2);
        const aisleLength = isVertical ? Math.abs(y1 - y2) : Math.abs(x1 - x2);
        const bays = aisleData.baysPerSide;
        
        const distanceAlongAisle = (aisleLength / bays) * (bayNum - 0.5);

        let x, y;
        if (isVertical) {
            x = x1;
            y = (y1 < y2) ? y1 + distanceAlongAisle : y1 - distanceAlongAisle;
        } else {
            y = y1;
            x = (x1 < x2) ? x1 + distanceAlongAisle : x1 - distanceAlongAisle;
        }
        
        const offset = aisleData.aisleWidth / 4; // Reduced offset
        if(isVertical) {
            x += (productLocation.side === 'Left' ? -offset : offset);
        } else {
            y += (productLocation.side === 'Left' ? -offset : offset);
        }

        return { x, y };
    }, [productLocation, aisles]);

  return (
    <>
      <style jsx global>{`
        @keyframes flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .flashing-indicator {
          animation: flash 1.5s infinite ease-in-out;
        }
        .zone rect { 
            stroke: hsl(var(--border) / 0.5); 
            stroke-width: 1; 
            rx: 4; 
            transition: all 0.2s ease-in-out; 
        }
        .zone text { 
            font-weight: 600;
            font-size: 14px;
            fill: hsl(var(--muted-foreground)); 
            letter-spacing: .2px; 
        }

        .zone[data-type="chilled"] rect { fill: hsl(var(--primary) / 0.1); }
        .zone[data-type="grocery"] rect { fill: hsl(var(--primary) / 0.15); }
        .zone[data-type="household"] rect { fill: hsl(var(--chart-4) / 0.2); }
        .zone[data-type="alcohol"] rect { fill: hsl(var(--secondary) / 0.8); }
        .zone[data-type="bev"] rect { fill: hsl(var(--chart-2) / 0.2); }
        .zone[data-type="front"] rect { fill: hsl(var(--accent) / 0.3); }

      `}</style>
      <div className="canvas-wrap p-4 bg-muted/20">
        <div className="board" style={{ maxWidth: `${layout.W}px` }}>
          <svg viewBox={`0 0 ${layout.W} ${layout.H}`} aria-labelledby="title desc" role="img">
            <title id="title">{meta.name}</title>
            <desc id="desc">Floor plan of store departments and aisles.</desc>

            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="1"/>
              </pattern>
            </defs>

            <rect x="0" y="0" width={layout.W} height={layout.H} fill="url(#grid)" opacity="0.2" />

            {aisles.map(aisle => {
                const [x1, y1] = aisle.p1;
                const [x2, y2] = aisle.p2;
                const isVertical = Math.abs(x1 - x2) < Math.abs(y1 - y2);
                
                const x = Math.min(x1, x2) - (isVertical ? aisle.aisleWidth / 2 : 0);
                const y = Math.min(y1, y2) - (isVertical ? 0 : aisle.aisleWidth / 2);
                const width = isVertical ? aisle.aisleWidth : Math.abs(x1-x2);
                const height = isVertical ? Math.abs(y1-y2) : aisle.aisleWidth;

                const textX = x + width/2;
                const textY = y + height/2;

                return (
                    <g key={aisle.id} className="zone" data-name={aisle.label} data-type={aisle.type}>
                        <rect 
                            x={x} 
                            y={y} 
                            width={width} 
                            height={height}
                         />
                        <text
                            x={textX}
                            y={textY}
                            dominantBaseline="central"
                            textAnchor="middle"
                            transform={isVertical ? `rotate(-90, ${textX}, ${textY})` : ''}
                        >
                            {aisle.label}
                        </text>
                    </g>
                )
            })}

            {itemPosition && (
                <>
                 <circle
                    cx={itemPosition.x}
                    cy={itemPosition.y}
                    r="15"
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--primary-foreground))"
                    strokeWidth="3"
                    className="flashing-indicator"
                />
                </>
            )}
          </svg>
        </div>
      </div>
    </>
  );
};

export default StoreMap;

    
