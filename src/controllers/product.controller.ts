import { Request, Response } from 'express';
import { scrapAmazon, scrapMercadoLibre, scrapNewEgg } from '../script-scrap';
import { formatUSD, getDollarOfficial } from '../utils/dollar';


export const getPricesProduct = async (req: Request, res: Response) => {
    const itemNumber = req.params['productId'];
    const dataNewEgg = await scrapNewEgg(itemNumber);
    const brand = dataNewEgg?.brand;
    const model = dataNewEgg?.model;

    if (brand && model) {

        const priceAmazon = await scrapAmazon(brand, model)
        const priceMercadoLibre = await scrapMercadoLibre(brand, model)

        const dollar = await getDollarOfficial();
        let priceMLusd = null;

        if (dollar && priceMercadoLibre?.price && priceMercadoLibre.price !== '0') {
            const priceStringCleaned = priceMercadoLibre.price.replace(/\./g, '').replace(',', '.');
            const priceNumber = parseFloat(priceStringCleaned);

            if (!isNaN(priceNumber)) {
                priceMLusd = (priceNumber / dollar.price).toFixed(2);
            }
        }


        console.log('Prices:');
        console.log('• NewEgg:', formatUSD(dataNewEgg.price));
        console.log('• Amazon:', formatUSD(priceAmazon?.price));
        console.log('• MercadoLibre:', `${priceMercadoLibre?.price} ARS (≈ ${priceMLusd} USD)`);

        res.json({
            newegg: dataNewEgg.price,
            amazon: priceAmazon?.price,
            mercadolibre: {
                ars: priceMercadoLibre?.price ? `$${priceMercadoLibre.price.replace(/\./g, ',')}` : '$0',
                usd: `$${priceMLusd}`
            }
        });
    } else {
        res.status(400).json({ error: 'No se pudo obtener brand y model desde NewEgg' });
    }
};
