
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
            y = Math.min(y1, y2) + distanceAlongAisle;
        } else {
            y = y1;
            x = Math.min(x1, x2) + distanceAlongAisle;
        }

        const offset = aisleData.aisleWidth / 2;
        if(isVertical) {
            x += (productLocation.side === 'Left' ? -offset : offset);
        } else {
            y += (productLocation.side === 'Left' ? -offset : offset);
        }

        return { x, y };
    }, [productLocation, aisles]);

  return (
    <>
      <div className="canvas-wrap p-4 bg-muted/20">
        <div className="board" style={{ maxWidth: `${layout.W}px` }}>
          <svg viewBox={`0 0 ${layout.W} ${layout.H}`} aria-labelledby="title desc" role="img">
            <title id="title">{meta.name}</title>
            <desc id="desc">Floor plan of store departments and aisles.</desc>

            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--grid)" strokeWidth="1"/>
              </pattern>
            </defs>

            <rect x="0" y="0" width={layout.W} height={layout.H} fill="url(#grid)" opacity="0.2" />

            {aisles.map(aisle => {
                const [x1, y1] = aisle.p1;
                const [x2, y2] = aisle.p2;
                const isVertical = Math.abs(x1 - x2) < Math.abs(y1 - y2);
                
                const x = Math.min(x1, x2);
                const y = Math.min(y1, y2);
                const width = isVertical ? aisle.aisleWidth : Math.abs(x1-x2);
                const height = isVertical ? Math.abs(y1-y2) : aisle.aisleWidth;

                const textX = x + width/2;
                const textY = y + height/2;

                return (
                    <g key={aisle.id} className="zone" data-name={aisle.label}>
                        <rect 
                            x={x} 
                            y={y} 
                            width={width} 
                            height={height}
                            fill="hsl(var(--secondary))"
                            stroke="hsl(var(--border))"
                            strokeWidth="1"
                            rx="4"
                         />
                        <text
                            x={textX}
                            y={textY}
                            fontSize="16"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="hsl(var(--secondary-foreground))"
                            className="font-semibold"
                            transform={isVertical ? `rotate(-90, ${textX}, ${textY})` : ''}
                        >
                            {aisle.label}
                        </text>
                    </g>
                )
            })}

            {itemPosition && (
                 <circle
                    cx={itemPosition.x}
                    cy={itemPosition.y}
                    r="15"
                    fill="hsla(var(--primary), 0.5)"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                />
            )}
          </svg>
        </div>
      </div>
    </>
  );
};

export default StoreMap;
