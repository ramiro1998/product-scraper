import { Request, Response } from 'express';
import { scrapAmazon, scrapNewEgg } from '../script-scrap';

export const getPricesProduct = async (req: Request, res: Response) => {
    const itemNumber = req.params['productId']
    const dataNewEgg = await scrapNewEgg(itemNumber)
    const brand = dataNewEgg?.brand
    const model = dataNewEgg?.model
    const page = dataNewEgg?.page

    if (brand && model) {
        const dataAmazon = await scrapAmazon(brand, model, page)
    }
};
