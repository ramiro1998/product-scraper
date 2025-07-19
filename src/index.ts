const express = require('express');
import productRoutes from "./routes/product.routes";
import { scrapNewEgg } from "./script-scrap";



const app = express();
app.use('/api', productRoutes)
app.use(express.json());

const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
