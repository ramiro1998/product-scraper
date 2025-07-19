import { Request, Response } from 'express';
import { scrapAmazon, scrapMercadoLibre, scrapNewEgg } from '../script-scrap';

export const getPricesProduct = async (req: Request, res: Response) => {
    const itemNumber = req.params['productId']
    const dataNewEgg = await scrapNewEgg(itemNumber)
    const brand = dataNewEgg?.brand
    const model = dataNewEgg?.model
    const page = dataNewEgg?.page

    if (brand && model) {
        const priceAmazon = await scrapAmazon(brand, model, page)
        const priceMercadoLibre = await scrapMercadoLibre(brand, model, page)
        console.log('priceAmazon', priceAmazon, 'priceMercadoLibre', priceMercadoLibre)
    }
};
