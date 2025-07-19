import axios from 'axios';

export const getDollarOfficial = async (): Promise<any> => {
  try {
    const response = await axios.get('https://criptoya.com/api/dolar');
    const dolar = response.data?.oficial;
    return dolar ?? null;
  } catch (err) {
    console.error('❌ Error obteniendo dólar oficial:', err);
    return null;
  }
};