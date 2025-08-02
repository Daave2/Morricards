/**
 * @fileOverview A mock API for fetching Morrisons product data.
 */

export interface FetchMorrisonsDataInput {
  locationId: string;
  skus: string[];
}

export type FetchMorrisonsDataOutput = {
  sku: string;
  name: string;
  price: number;
  stockQuantity: number;
  location: string;
  promotion?: string;
}[];

// Mock database of products
const allProducts: FetchMorrisonsDataOutput = [
    { sku: '89123', name: 'Morrisons British Semi-Skimmed Milk 2L', price: 1.65, stockQuantity: 150, location: 'Aisle 1, Fridge 2', promotion: '2 for £3.00' },
    { sku: '45892', name: 'Hovis Soft White Medium Bread 800g', price: 1.39, stockQuantity: 80, location: 'Aisle 3, Shelf 1' },
    { sku: '67345', name: 'Morrisons The Best Thick Pork Sausages 6pk', price: 3.00, stockQuantity: 45, location: 'Aisle 10, Meat Counter' },
    { sku: '19876', name: 'Heinz Baked Beanz in Tomato Sauce 415g', price: 1.40, stockQuantity: 250, location: 'Aisle 4, Shelf 5', promotion: '4 for £4.00' },
    { sku: '55432', name: 'Morrisons Mature Cheddar 400g', price: 3.50, stockQuantity: 70, location: 'Aisle 1, Fridge 3' },
    { sku: '23456', name: 'Walkers Crisps Variety Multipack 20x25g', price: 5.00, stockQuantity: 90, location: 'Aisle 6, Shelf 2' },
    { sku: '78901', name: 'Coca-Cola Original Taste 24x330ml', price: 11.00, stockQuantity: 120, location: 'Aisle 7, Drinks Section', promotion: 'Clubcard Price £9.00' },
    { sku: '33214', name: 'Morrisons British Chicken Breast Fillets 1kg', price: 7.50, stockQuantity: 30, location: 'Aisle 10, Poultry' },
    { sku: '66554', name: 'Fairy Non-Bio Washing Pods 51 Washes', price: 10.00, stockQuantity: 60, location: 'Aisle 9, Laundry' },
    { sku: '98765', name: 'Andrex Gentle Clean Toilet Roll 16 Rolls', price: 9.75, stockQuantity: 110, location: 'Aisle 9, Paper Goods' },
    { sku: '11223', name: 'Morrisons Bananas 5pk', price: 0.95, stockQuantity: 200, location: 'Fruit & Veg, Stand 1' },
    { sku: '44332', name: 'Morrisons Free Range Eggs 12pk', price: 2.75, stockQuantity: 85, location: 'Aisle 1, Fridge 1' },
    { sku: '88776', name: 'Nescafé Gold Blend Instant Coffee 200g', price: 6.00, stockQuantity: 55, location: 'Aisle 5, Hot Drinks' },
    { sku: '22998', name: 'Cadbury Dairy Milk Chocolate Bar 110g', price: 1.25, stockQuantity: 300, location: 'Aisle 6, Confectionery' },
    { sku: '55667', name: 'Morrisons Orange Juice with Bits 1.75L', price: 2.50, stockQuantity: 95, location: 'Aisle 1, Juice Fridge' },
];


export async function fetchMorrisonsData(input: FetchMorrisonsDataInput): Promise<FetchMorrisonsDataOutput> {
  console.log(`Fetching data for SKUs: ${input.skus.join(', ')} at location: ${input.locationId}`);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
  
  const foundProducts = allProducts.filter(p => input.skus.includes(p.sku));

  // Simulate some randomness in stock levels based on location
  const locationSpecificProducts = foundProducts.map(p => ({
    ...p,
    stockQuantity: Math.floor(p.stockQuantity * (0.8 + Math.random() * 0.4)), // +/- 20% variation
  }));
  
  return locationSpecificProducts;
}
