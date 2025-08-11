
'use client';

import { cn } from "@/lib/utils";

const mapLayout = [
    ['Produce', 'Produce', null, null, null, null, 'Beers, Wines, Spirits', 'Crisps & Snacks'],
    ['Produce', 'Produce', null, null, null, null, 'Beers, Wines, Spirits', 'Crisps & Snacks'],
    ['Produce', 'Produce', null, 'Deli', null, null, 'Beers, Wines, Spirits', 'Crisps & Snacks'],
    ['Cereal', 'Bread & Jam', 'Tea & Coffee', 'Deli', null, null, null, null],
    ['Cereal', 'Bread & Jam', 'Tea & Coffee', null, null, 'Soft Drinks', 'Household', 'Pet Food'],
    ['Cereal', 'Bread & Jam', 'Tea & Coffee', null, 'Frozen', 'Soft Drinks', 'Household', 'Pet Food'],
    ['Cooking Sauces', 'Tins & Packets', 'Pasta & Rice', 'Frozen', 'Soft Drinks', 'Household', 'Pet Food'],
    ['Cooking Sauces', 'Tins & Packets', 'Pasta & Rice', 'Frozen', null, null, null, null],
    ['Cooking Sauces', 'Tins & Packets', 'Pasta & Rice', 'Frozen', 'Home Baking', 'Desserts', 'Free From'],
    [null, null, null, 'Frozen', 'Home Baking', 'Desserts', 'Free From'],
    ['Baby', 'Health & Beauty', 'Tins & Packets', 'Seasonal', 'Home Baking', 'Desserts', 'Free From'],
    ['Baby', 'Health & Beauty', 'Tins & Packets', 'Seasonal', null, null, null, null],
    ['Baby', 'Health & Beauty', 'Tins & Packets', 'Seasonal', 'Market Street', 'Food To Go', null],
    ['Checkouts', 'Checkouts', 'Checkouts', null, 'Market Street', 'Food To Go', null],
    ['Checkouts', 'Checkouts', 'Checkouts', null, null, null, null, null],
    ['Entrance', null, null, null, null, null, null, null],
];

// This mapping helps align data from the API with the labels on our map.
const AISLE_NAME_MAP: Record<string, string> = {
    'Ambient Grocery': 'Tins & Packets',
    'Confectionery, Snacks & Biscuits': 'Crisps & Snacks',
    'Drinks': 'Soft Drinks',
    'Household & Pet': 'Pet Food',
    'News, Mags, Tobacco & Home': 'Household',
    'Beers, Wines & Spirits': 'Beers, Wines, Spirits',
};


interface StoreMapProps {
  highlightedAisle?: string | null;
}

const StoreMap = ({ highlightedAisle }: StoreMapProps) => {
    
  const getMappedAisle = (aisleName: string | null) => {
    if (!aisleName) return null;
    return AISLE_NAME_MAP[aisleName] || aisleName;
  }
  
  const finalHighlightedAisle = getMappedAisle(highlightedAisle);

  return (
    <div className="bg-muted p-4 rounded-lg overflow-x-auto">
      <div className="grid grid-cols-8 gap-1 min-w-[800px]">
        {mapLayout.flat().map((aisle, index) => {
          const isHighlighted = aisle && finalHighlightedAisle && aisle === finalHighlightedAisle;
          return (
            <div
              key={index}
              className={cn(
                'h-16 flex items-center justify-center p-1 text-center rounded-md text-xs font-semibold leading-tight',
                aisle ? 'bg-card border' : 'bg-transparent',
                isHighlighted ? 'bg-primary text-primary-foreground ring-2 ring-offset-2 ring-primary transition-all' : 
                aisle ? 'text-muted-foreground' : ''
              )}
            >
              {aisle}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StoreMap;
