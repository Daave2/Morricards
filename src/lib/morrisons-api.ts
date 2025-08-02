/**
 * @fileOverview An API for fetching Morrisons product data.
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

// This is a placeholder API. In a real-world scenario, this would be a proper authenticated API.
const API_ENDPOINT = 'https://groceries.morrisons.com/api/products/v2/details';

interface MorrisonsProduct {
    name: string;
    sku: string;
    sales_unit: string;
    typical_weight: {
      value: string;
      unit: string;
    };
    image: {
      url: string;
    };
    price: {
      price: {
        value: string;
      };
      unit_price: {
        value: string;
        per: string;
      };
    };
    promotions: {
      text: string;
    }[];
    availability: {
      stock_level: number;
      is_in_stock: boolean;
    };
    aisle: {
      name: string;
    }
}

interface ApiResponse {
    items: MorrisonsProduct[];
}

export async function fetchMorrisonsData(input: FetchMorrisonsDataInput): Promise<FetchMorrisonsDataOutput> {
  console.log(`Fetching data for SKUs: ${input.skus.join(', ')} at location: ${input.locationId}`);

  const params = new URLSearchParams({
    'skus': input.skus.join(','),
    'storeId': input.locationId, 
  });

  try {
    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        }
    });

    if (!response.ok) {
        console.error('Morrisons API request failed with status:', response.status);
        throw new Error(`API request failed: ${response.statusText}`);
    }

    const result: ApiResponse = await response.json();

    if (!result || !result.items) {
        console.log('No items found in Morrisons API response');
        return [];
    }
    
    const products: FetchMorrisonsDataOutput = result.items.map(item => ({
        sku: item.sku,
        name: item.name,
        price: parseFloat(item.price.price.value),
        stockQuantity: item.availability.stock_level,
        location: item.aisle.name,
        promotion: item.promotions.length > 0 ? item.promotions[0].text : undefined
    }));

    return products;

  } catch (error) {
    console.error('Failed to fetch data from Morrisons API:', error);
    // In case of an error, we can return an empty array or re-throw.
    // For this app, returning an empty array is safer to prevent crashes.
    return [];
  }
}
