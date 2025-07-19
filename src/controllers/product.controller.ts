import { Request, Response } from 'express';
import { scrapAmazon, scrapMercadoLibre, scrapNewEgg } from '../script-scrap';
import { getDollarOfficial } from '../utils/getDollarPrice';

const formatUSD = (value: string | number | undefined | null): string => {
    if (!value) return 'N/A';
    const number = typeof value === 'string'
        ? parseFloat(value.replace(/[^0-9.]/g, ''))
        : value;
    return isNaN(number) ? 'N/A' : `${number.toFixed(2)} USD`;
};

export const getPricesProduct = async (req: Request, res: Response) => {
    const itemNumber = req.params['productId'];
    const dataNewEgg = await scrapNewEgg(itemNumber);
    const brand = dataNewEgg?.brand;
    const model = dataNewEgg?.model;
    const page = dataNewEgg?.page;

    if (brand && model) {

        const priceAmazon = await scrapAmazon(brand, model, page)
        const priceMercadoLibre = await scrapMercadoLibre(brand, model, page)

        const dollar = await getDollarOfficial();
        console.log('dollar', dollar)
        let priceMLusd = null;

        if (dollar && priceMercadoLibre?.price) {
            console.log('Precio original ML:', priceMercadoLibre.price);
            const priceString = priceMercadoLibre.price.replace(/\./g, '').replace(',', '.');
            console.log('Precio parseado ML:', priceString);
            const priceNumber = parseFloat(priceString);
            console.log('Número parseado:', priceNumber);

            if (!isNaN(priceNumber)) {
                priceMLusd = (priceNumber / dollar.price).toFixed(2);
            } else {
                console.warn('❌ No se pudo parsear el precio de MercadoLibre.');
            }
        }

        console.log('💰 Precios:');
        console.log('• NewEgg:', formatUSD(dataNewEgg.price));
        console.log('• Amazon:', formatUSD(priceAmazon?.price));
        console.log('• MercadoLibre:', `${priceMercadoLibre?.price} ARS (≈ ${priceMLusd} USD)`);

        res.json({
            newegg: dataNewEgg.price,
            amazon: priceAmazon?.price,
            mercadolibre: {
                ars: priceMercadoLibre?.price,
                usd: priceMLusd
            }
        });
    } else {
        res.status(400).json({ error: 'No se pudo obtener brand y model desde NewEgg' });
    }
};
