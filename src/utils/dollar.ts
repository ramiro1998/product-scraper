import axios from 'axios';

export const getDollarOfficial = async (): Promise<any> => {
  try {
    const response = await axios.get('https://criptoya.com/api/dolar');
    const dolar = response.data?.oficial;
    return dolar ?? null;
  } catch (err) {
    console.error('Error getting dollar price:', err);
    return null;
  }
};

export const formatUSD = (value: string | number | undefined | null): string => {
  if (!value) return 'N/A';
  const number = typeof value === 'string'
    ? parseFloat(value.replace(/[^0-9.]/g, ''))
    : value;
  return isNaN(number) ? 'N/A' : `${number.toFixed(2)} USD`;
};


interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  factor?: number;
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T | null> {
  const { maxRetries = 3, initialDelayMs = 1000, factor = 2 } = options || {};
  let retries = 0;
  let delay = initialDelayMs;

  while (retries <= maxRetries) {
    try {
      console.log(`Running attempt ${retries + 1} of ${maxRetries + 1})...`);
      const result = await fn();
      return result;
    } catch (error: any) {
      console.error(`Failed in attempt ${retries + 1}: ${error.message}`);
      if (retries < maxRetries) {
        console.log(`Retrying in ${delay / 1000} second...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= factor;
      } else {
        console.error(`Failed after ${maxRetries + 1} attempts.`);
        return null;
      }
    }
    retries++;
  }
  return null;
}