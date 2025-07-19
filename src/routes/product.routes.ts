import { Router } from 'express';
import { getPricesProduct } from '../controllers/product.controller';

const router = Router();

router.get('/getPrice/:productId', getPricesProduct);

export default router;
