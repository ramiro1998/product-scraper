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

        let MLresponse: {
            ars?: string;
            usd?: string;
        } | string = {
            ars: priceMercadoLibre?.price ? `$${priceMercadoLibre.price.replace(/\./g, ',')}` : 'Not found',
            usd: priceMercadoLibre?.price ? `$${priceMLusd}` : 'Not found'
        };

        if (MLresponse.ars === 'Not found') {
            MLresponse = 'Not found'
        }

        res.json({
            newegg: dataNewEgg.price,
            amazon: priceAmazon?.price ?? 'Not found',
            mercadolibre: MLresponse
        });

    } else {
        res.status(400).json({ error: 'Error when trying to get brand and model from NewEgg' });
    }
};
