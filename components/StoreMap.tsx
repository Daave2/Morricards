
'use client';

import { useEffect, useRef, useState } from "react";

interface StoreMapProps {
  highlightedAisle?: string | null;
}

const StoreMap = ({ highlightedAisle }: StoreMapProps) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const zoomRef = useRef<HTMLInputElement>(null);
    const boardRef = useRef<HTMLDivElement>(null);
    const hintRef = useRef<HTMLDivElement>(null);

    const [selectedZone, setSelectedZone] = useState<Element | null>(null);

    const applySearch = (query: string) => {
        const q = query.trim().toLowerCase();
        const svg = svgRef.current;
        if (!svg) return;
        const zones = Array.from(svg.querySelectorAll('.zone'));
        zones.forEach(z => {
            const name = ((z as HTMLElement).dataset.name || '').toLowerCase();
            if (!q) {
                z.classList.remove('match');
                return;
            }
            z.classList.toggle('match', name.includes(q));
        });
    };
    
    useEffect(() => {
        if (highlightedAisle) {
            applySearch(highlightedAisle);
        }
    }, [highlightedAisle])


    useEffect(() => {
        const svg = svgRef.current;
        const board = boardRef.current;
        const search = searchRef.current;
        const zoom = zoomRef.current;
        const hint = hintRef.current;
        
        if (!svg || !board || !search || !zoom || !hint) return;
        
        const zones = Array.from(svg.querySelectorAll('.zone'));
        let selected: Element | null = null;
        
        const handleSearchInput = () => {
            applySearch(search.value);
        }

        const handleZoneClick = (e: Event) => {
            const z = e.currentTarget as Element;
            if (selected) selected.classList.remove('selected');
            selected = z;
            z.classList.add('selected');
            if(hint) hint.textContent = (z as HTMLElement).dataset.name || "Unknown Zone";
            setSelectedZone(z);
        };
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selected) selected.classList.remove('selected');
                selected = null;
                search.value = '';
                applySearch('');
                if (hint) hint.textContent = 'Click a zone or use search to highlight. Esc clears selection.';
                setSelectedZone(null);
            }
        };

        const setZoom = () => {
            const v = Number(zoom.value) / 100;
            board.style.transform = `scale(${v})`;
            board.style.transformOrigin = 'top center';
        };

        search.addEventListener('input', handleSearchInput);
        zoom.addEventListener('input', setZoom);
        zones.forEach(z => z.addEventListener('click', handleZoneClick));
        window.addEventListener('keydown', handleKeyDown);

        setZoom();

        return () => {
            search.removeEventListener('input', handleSearchInput);
            zoom.removeEventListener('input', setZoom);
            zones.forEach(z => z.removeEventListener('click', handleZoneClick));
            window.removeEventListener('keydown', handleKeyDown);
        }

    }, []);
    

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #f6f7fb;
          --ink: #0f172a;
          --muted: #6b7280;
          --grid: #d4d4d8;
          --accent: #16a34a;

          /* Category fills */
          --chilled: #cfe8ff;      /* blues */
          --grocery: #f3d1ff;      /* pink/magenta */
          --household: #ffd9b2;    /* orange */
          --alcohol: #e5e7eb;      /* gray */
          --bev: #dbeafe;          /* light blue */
          --front: #fde68a;        /* yellow */
        }
        .map-header {
          display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; justify-content: space-between;
          padding: 1rem 1.25rem; background: rgba(255,255,255,.85);
          backdrop-filter: blur(6px); border-bottom: 1px solid #e5e7eb;
        }
        .map-header h1 { font-size: clamp(1.1rem, 1.2rem + .8vw, 1.8rem); margin: 0; font-weight: 800; }

        .map-controls { display:flex; gap: .75rem; align-items: center; }
        .map-controls input[type="search"]{
          padding: .55rem .75rem; border: 1px solid #cbd5e1; border-radius: .6rem; min-width: 16rem; font-size: .95rem;
        }
        .map-controls .zoom { display:flex; gap:.5rem; align-items:center; font-size:.9rem; color:var(--muted); }

        .canvas-wrap { padding: 1rem; background-color: #f6f7fb; }
        .board {
          width: 100%; margin: 0 auto; background: white; border-radius: 16px;
          overflow: hidden; position: relative;
        }

        .map-svg { width: 100%; height: auto; display: block; background: white; }

        /* Zones */
        .zone rect { stroke: #334155; stroke-width: 2; rx: 10; }
        .zone text { font-weight: 800; fill: #111827; letter-spacing: .2px; }

        .zone[data-type="chilled"] rect { fill: var(--chilled); }
        .zone[data-type="grocery"] rect { fill: var(--grocery); }
        .zone[data-type="household"] rect { fill: var(--household); }
        .zone[data-type="alcohol"] rect { fill: var(--alcohol); }
        .zone[data-type="bev"] rect { fill: var(--bev); }
        .zone[data-type="front"] rect { fill: var(--front); }

        .zone { cursor: pointer; transition: filter .2s ease, opacity .2s ease; }
        .zone:hover { filter: brightness(1.02) drop-shadow(0 2px 4px rgba(0,0,0,.08)); }

        .zone.match rect, .zone.selected rect { stroke: #16a34a; stroke-width: 4px; }

        .hint {
          position: absolute; bottom: 12px; left: 12px; background: rgba(15,23,42,.9); color: #f8fafc;
          padding: .6rem .8rem; border-radius: .6rem; font-size: .9rem; box-shadow: 0 6px 16px rgba(2,6,23,.3);
        }
        .legend { display:flex; flex-wrap: wrap; gap:.5rem .9rem; align-items:center; font-size:.9rem; color:var(--muted); }
        .swatch { width: 14px; height: 14px; border-radius: 4px; display:inline-block; vertical-align: middle; margin-right:.4rem; border:1px solid #94a3b8; }
      `}</style>
      <header className="map-header">
        <h1>Store Floor Plan</h1>
        <div className="map-controls">
          <label className="zoom" htmlFor="zoom">Zoom <input ref={zoomRef} id="zoom" type="range" min="50" max="200" defaultValue="100"/></label>
          <input ref={searchRef} id="search" type="search" placeholder="Search for an area..." />
        </div>
      </header>

      <div className="canvas-wrap">
        <div ref={boardRef} className="board">
          <svg ref={svgRef} className="map-svg" viewBox="0 0 1600 900" aria-labelledby="title desc" role="img">
            <title id="title">Store plan</title>
            <desc id="desc">Interactive, scalable floor plan of store departments and aisles.</desc>

            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--grid)" strokeWidth="1"/>
              </pattern>
            </defs>

            <rect x="0" y="0" width="1600" height="900" fill="url(#grid)" opacity="0.2" />

            <g className="zone" data-name="Meat" data-type="chilled">
              <rect x="40" y="20" width="180" height="60" />
              <text x="130" y="60" fontSize="28" textAnchor="middle">Meat</text>
            </g>
            <g className="zone" data-name="Cakes" data-type="chilled">
              <rect x="240" y="20" width="150" height="60" />
              <text x="315" y="60" fontSize="28" textAnchor="middle">Cakes</text>
            </g>
            <g className="zone" data-name="Bakery" data-type="chilled">
              <rect x="410" y="20" width="170" height="60" />
              <text x="495" y="60" fontSize="28" textAnchor="middle">Bakery</text>
            </g>
            <g className="zone" data-name="Deli" data-type="chilled">
              <rect x="600" y="20" width="170" height="60" />
              <text x="685" y="60" fontSize="28" textAnchor="middle">Deli</text>
            </g>
            <g className="zone" data-name="Ovens" data-type="chilled">
              <rect x="790" y="20" width="200" height="60" />
              <text x="890" y="60" fontSize="28" textAnchor="middle">Ovens</text>
            </g>
            <g className="zone" data-name="Ham" data-type="chilled">
              <rect x="1010" y="20" width="140" height="60" />
              <text x="1080" y="60" fontSize="28" textAnchor="middle">Ham</text>
            </g>
            <g className="zone" data-name="Seafood" data-type="chilled">
              <rect x="1160" y="20" width="200" height="60" />
              <text x="1260" y="60" fontSize="28" textAnchor="middle">Seafood</text>
            </g>

            <g className="zone" data-name="Butter" data-type="chilled">
              <rect x="40" y="110" width="150" height="110" />
              <text x="115" y="165" fontSize="26" textAnchor="middle" transform="rotate(-90 115 165)">Butter</text>
            </g>
            <g className="zone" data-name="Cheese" data-type="chilled">
              <rect x="40" y="230" width="150" height="150" />
              <text x="115" y="305" fontSize="26" textAnchor="middle" transform="rotate(-90 115 305)">Cheese</text>
            </g>
            <g className="zone" data-name="Dairy" data-type="chilled">
              <rect x="40" y="390" width="150" height="110" />
              <text x="115" y="445" fontSize="26" textAnchor="middle" transform="rotate(-90 115 445)">Dairy</text>
            </g>
            <g className="zone" data-name="Frozen" data-type="chilled">
              <rect x="40" y="510" width="150" height="170" />
              <text x="115" y="595" fontSize="26" textAnchor="middle" transform="rotate(-90 115 595)">Frozen</text>
            </g>
            <g className="zone" data-name="Frozen 2" data-type="chilled">
              <rect x="40" y="690" width="150" height="170" />
              <text x="115" y="775" fontSize="26" textAnchor="middle" transform="rotate(-90 115 775)">Frozen</text>
            </g>

            <g className="zone" data-name="Ready Meals" data-type="chilled">
              <rect x="1420" y="110" width="140" height="110" />
              <text x="1490" y="165" fontSize="26" textAnchor="middle" transform="rotate(-90 1490 165)">Ready Meals</text>
            </g>
            <g className="zone" data-name="Dips" data-type="chilled">
              <rect x="1420" y="230" width="140" height="110" />
              <text x="1490" y="285" fontSize="26" textAnchor="middle" transform="rotate(-90 1490 285)">Dips</text>
            </g>
            <g className="zone" data-name="Pizzas" data-type="chilled">
              <rect x="1420" y="350" width="140" height="130" />
              <text x="1490" y="415" fontSize="26" textAnchor="middle" transform="rotate(-90 1490 415)">Pizzas</text>
            </g>
            <g className="zone" data-name="Coleslaw" data-type="chilled">
              <rect x="1420" y="490" width="140" height="110" />
              <text x="1490" y="545" fontSize="26" textAnchor="middle" transform="rotate(-90 1490 545)">Coleslaw</text>
            </g>
            <g className="zone" data-name="Fruit & Veg" data-type="chilled">
              <rect x="1420" y="610" width="140" height="250" />
              <text x="1490" y="735" fontSize="26" textAnchor="middle" transform="rotate(-90 1490 735)">Fruit & Veg</text>
            </g>

            <g className="zone" data-name="Free From" data-type="grocery">
              <rect x="220" y="160" width="80" height="320" />
              <text x="260" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 260 320)">Free From</text>
            </g>
            <g className="zone" data-name="Bread/Jam" data-type="grocery">
              <rect x="310" y="160" width="80" height="320" />
              <text x="350" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 350 320)">Bread/Jam</text>
            </g>
            <g className="zone" data-name="Cereal/Sugar" data-type="grocery">
              <rect x="400" y="160" width="80" height="320" />
              <text x="440" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 440 320)">Cereal/Sugar</text>
            </g>
            <g className="zone" data-name="Desserts/Tea" data-type="grocery">
              <rect x="490" y="160" width="80" height="320" />
              <text x="530" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 530 320)">Desserts/Tea</text>
            </g>
            <g className="zone" data-name="Home Bake" data-type="grocery">
              <rect x="580" y="160" width="80" height="320" />
              <text x="620" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 620 320)">Home bake</text>
            </g>
            <g className="zone" data-name="Spices/meat" data-type="grocery">
              <rect x="670" y="160" width="80" height="320" />
              <text x="710" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 710 320)">Spices/meat</text>
            </g>
            <g className="zone" data-name="Soup/Veg" data-type="grocery">
              <rect x="760" y="160" width="80" height="320" />
              <text x="800" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 800 320)">Soup/Veg</text>
            </g>
            <g className="zone" data-name="International" data-type="grocery">
              <rect x="850" y="160" width="80" height="320" />
              <text x="890" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 890 320)">International</text>
            </g>
            <g className="zone" data-name="Sweets" data-type="grocery">
              <rect x="940" y="160" width="80" height="320" />
              <text x="980" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 980 320)">Sweets</text>
            </g>
            <g className="zone" data-name="Biscuits" data-type="grocery">
              <rect x="1030" y="160" width="80" height="320" />
              <text x="1070" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 1070 320)">Biscuits</text>
            </g>
            <g className="zone" data-name="Crisps" data-type="grocery">
              <rect x="1120" y="160" width="80" height="320" />
              <text x="1160" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 1160 320)">Crisps</text>
            </g>

            <g className="zone" data-name="Beer" data-type="alcohol">
              <rect x="1210" y="160" width="80" height="320" />
              <text x="1250" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 1250 320)">Beer</text>
            </g>
            <g className="zone" data-name="Spirits" data-type="alcohol">
              <rect x="1300" y="160" width="80" height="320" />
              <text x="1340" y="320" fontSize="24" textAnchor="middle" transform="rotate(-90 1340 320)">Spirits</text>
            </g>
            <g className="zone" data-name="Wine" data-type="alcohol">
              <rect x="1390" y="160" width="20" height="320" opacity="0" />
              <rect x="1290" y="90" width="180" height="50" fill="var(--alcohol)" stroke="#334155" strokeWidth="2" rx="10"/>
              <text x="1380" y="125" fontSize="22" textAnchor="middle">Wine</text>
            </g>
            
            <g className="zone" data-name="Paper" data-type="household">
              <rect x="220" y="500" width="80" height="220" />
              <text x="260" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 260 610)">Paper</text>
            </g>
            <g className="zone" data-name="Cleaning" data-type="household">
              <rect x="310" y="500" width="80" height="220" />
              <text x="350" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 350 610)">Cleaning</text>
            </g>
            <g className="zone" data-name="Cat" data-type="household">
              <rect x="400" y="500" width="80" height="220" />
              <text x="440" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 440 610)">Cat</text>
            </g>
            <g className="zone" data-name="Dog" data-type="household">
              <rect x="490" y="500" width="80" height="220" />
              <text x="530" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 530 610)">Dog</text>
            </g>
            <g className="zone" data-name="Health & Beauty" data-type="household">
              <rect x="580" y="500" width="80" height="220" />
              <text x="620" y="610" fontSize="20" textAnchor="middle" transform="rotate(-90 620 610)">Health & Beauty</text>
            </g>
            <g className="zone" data-name="Baby" data-type="household">
              <rect x="670" y="500" width="80" height="220" />
              <text x="710" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 710 610)">Baby</text>
            </g>
            <g className="zone" data-name="Clothes" data-type="household">
              <rect x="760" y="500" width="80" height="220" />
              <text x="800" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 800 610)">Clothes</text>
            </g>
            <g className="zone" data-name="Seasonal" data-type="household">
              <rect x="850" y="500" width="80" height="220" />
              <text x="890" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 890 610)">Seasonal</text>
            </g>
            <g className="zone" data-name="Home" data-type="household">
              <rect x="940" y="500" width="80" height="220" />
              <text x="980" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 980 610)">Home</text>
            </g>
            <g className="zone" data-name="Leisure" data-type="household">
              <rect x="1030" y="500" width="80" height="220" />
              <text x="1070" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 1070 610)">Leisure</text>
            </g>
            <g className="zone" data-name="Cook shop" data-type="household">
              <rect x="1120" y="500" width="80" height="220" />
              <text x="1160" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 1160 610)">Cook shop</text>
            </g>

            <g className="zone" data-name="Pop" data-type="bev">
              <rect x="1210" y="500" width="80" height="220" />
              <text x="1250" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 1250 610)">Pop</text>
            </g>
            <g className="zone" data-name="Water" data-type="bev">
              <rect x="1300" y="500" width="80" height="220" />
              <text x="1340" y="610" fontSize="22" textAnchor="middle" transform="rotate(-90 1340 610)">Water</text>
            </g>
            
            <g className="zone" data-name="Checkout Sweets" data-type="front">
              <rect x="380" y="740" width="720" height="80" />
              <text x="740" y="790" fontSize="26" textAnchor="middle">Checkout Sweets</text>
            </g>
            <g className="zone" data-name="Stationery" data-type="front">
              <rect x="1120" y="740" width="200" height="80" />
              <text x="1220" y="790" fontSize="24" textAnchor="middle">Stationery</text>
            </g>
            <g className="zone" data-name="Partyware" data-type="front">
              <rect x="1340" y="740" width="120" height="80" />
              <text x="1400" y="790" fontSize="24" textAnchor="middle">Partyware</text>
            </g>
            <g className="zone" data-name="Meal Deal" data-type="front">
              <rect x="1240" y="840" width="220" height="40" />
              <text x="1350" y="868" fontSize="20" textAnchor="middle">Meal Deal</text>
            </g>
          </svg>
          <div ref={hintRef} id="hint" className="hint">Click a zone or use search to highlight. Esc clears selection.</div>
        </div>

        <div style={{maxWidth: '1600px', margin:'10px auto 0', display:'flex', justifyContent: 'space-between', alignItems:'center', gap:'1rem', flexWrap:'wrap', padding: '0 .25rem'}}>
          <div className="legend">
            <span><i className="swatch" style={{background:'var(--chilled)'}}></i>Chilled & Fresh</span>
            <span><i className="swatch" style={{background:'var(--grocery)'}}></i>Grocery</span>
            <span><i className="swatch" style={{background:'var(--household)'}}></i>Household</span>
            <span><i className="swatch" style={{background:'var(--bev)'}}></i>Beverages</span>
            <span><i className="swatch" style={{background:'var(--alcohol)'}}></i>Beer/Wine/Spirits</span>
            <span><i className="swatch" style={{background:'var(--front)'}}></i>Front of Store</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default StoreMap;
