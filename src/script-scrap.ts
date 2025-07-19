import { chromium } from 'playwright';

export const scrapNewEgg = async (itemNumber: string) => {
    const url = 'https://www.newegg.com/';

    try {
        const page = await createPage();

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('div.header2021-search-inner');
        await page.click('input[type="search"]');
        await page.fill('input[type="search"]', itemNumber);
        await page.keyboard.press('Enter');
        await page.waitForSelector('div.price-current');
        await page.waitForSelector('div.tab-navs');

        const price = await page.locator('div.price-current').first().textContent();
        await page.waitForTimeout(1000);
        console.log('priceeeeee', price)
        const specsTab = page.locator('div[data-nav="Specs"]');
        await specsTab.waitFor({
            state: 'visible',
            timeout: 10000,
        });

        await specsTab.scrollIntoViewIfNeeded();
        await specsTab.click();
        await page.waitForSelector('table.table-horizontal');

        const rows = await page.$$('table.table-horizontal tr');

        let brand = null;
        let model = null;

        for (const row of rows) {
            const label = await row.$eval('th', el => el.textContent?.trim());
            const value = await row.$eval('td', el => el.textContent?.trim());

            if (label === 'Brand') brand = value;
            if (label === 'Model') model = value;
        }

        return { brand, model, price, page };
    } catch (error) {
        console.error('Error en scrapNewEgg:', error);
        return null;
    }
};


export const scrapAmazon = async (brand: string, model: string, page: any) => {
    const url = 'https://www.amazon.com/?language=en_US';

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });


        console.log('[2] Esperando el campo de búsqueda...');
        // await page.waitForSelector('#twotabsearchtextbox');
        // await page.waitForSelector('#nav-bb-search');
        await page.waitForSelector('#twotabsearchtextbox, #nav-bb-search');

        console.log('[3] Click en input...');
        await page.click('input[type="text"]');

        const searchTerm = `${brand} ${model}`;
        console.log(`[4] Buscando: ${searchTerm}`);
        await page.fill('input[type="text"]', searchTerm);

        console.log('[5] Presionando Enter...');
        await page.keyboard.press('Enter');

        console.log('[6] Esperando resultados...');
        await page.waitForSelector('#search', { timeout: 10000 });


        const noResultsLocator = page.locator('h2 span:has-text("No results for")');
        let price
        if (await noResultsLocator.count() > 0) {
            console.log('⚠️ No se encontraron resultados para la búsqueda.');
            price = 0
            return { price };
        }

        console.log('[7] Seleccionando primer producto...');
        const firstProduct = page.locator('a.a-link-normal.s-line-clamp-2.s-link-style.a-text-normal').first();
        await firstProduct.click();

        console.log('[8] Esperando carga del producto...');
        await page.waitForLoadState('domcontentloaded');

        console.log('[8.5] Buscando precio...');
        await page.waitForSelector('span.a-price span.a-offscreen', { timeout: 5000 });
        price = await page.locator('span.a-price span.a-offscreen').first().textContent();
        console.log('Precio:', price?.trim());

        console.log('[9] Obteniendo título...');
        const title = await page.locator('span#productTitle').first().textContent();
        console.log('Título:', title?.trim());
        if (title.includes(model)) {
            return { price }
        }

        console.log('[10] Esperando a que carguen los detalles del producto...');
        await page.waitForSelector('#productDetails_detailBullets_sections1', { timeout: 5000 });

        const parentSelector = '#prodDetails';

        // Verifico que exista el contenedor
        const parentExists = await page.locator(parentSelector).count();
        let modelMatch = false;
        if (parentExists === 0) {
            console.log('⚠️ No se encontró el div #prodDetails');
        } else {
            const tables = page.locator(`${parentSelector} table`);
            const tableCount = await tables.count();


            for (let i = 0; i < tableCount; i++) {
                const table = tables.nth(i);
                const rows = table.locator('tr');
                const rowCount = await rows.count();

                for (let j = 0; j < rowCount; j++) {
                    const row = rows.nth(j);
                    // Los key suelen estar en <th> y el value en <td>
                    const key = await row.locator('th').first().textContent();
                    const value = await row.locator('td').first().textContent();

                    const k = key?.trim();
                    const v = value?.trim();

                    if (k && v) {
                        if (v.toLowerCase().includes(model.toLowerCase())) {
                            console.log(`• ${k}: ${v}`);
                            modelMatch = true;
                        }
                    }
                }
            }

            console.log(`¿El modelo coincide en los detalles? ${modelMatch ? '✅ Sí' : '❌ No'}`);
        }

        console.log('✅ Scraping Amazon finalizado correctamente');
        if (!modelMatch) price = 0
        return { price }

    } catch (error) {
        console.error('❌ Error en scrapAmazon:', error);
    }
};

export const scrapMercadoLibre = async (brand: string, model: string, page: any) => {
    const url = 'https://www.mercadolibre.com.ar/';

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        console.log('[1] Esperando input de búsqueda...');
        await page.waitForSelector('input[name="as_word"]');

        const searchTerm = `${brand} ${model}`;
        console.log(`[2] Buscando: ${searchTerm}`);
        await page.fill('input[name="as_word"]', searchTerm);
        await page.keyboard.press('Enter');

        console.log('[3] Esperando resultados...');
        await page.waitForSelector('li.ui-search-layout__item');

        console.log('[4] Buscando producto que contenga el modelo...');

        const productTitles = page.locator('h3.poly-component__title-wrapper');
        const count = await productTitles.count();

        let found = false;

        for (let i = 0; i < Math.min(10, count); i++) {
            const titleElement = productTitles.nth(i);
            const titleText = (await titleElement.textContent())?.toLowerCase();

            if (titleText?.includes(model.toLowerCase())) {
                console.log(`✅ Coincidencia encontrada en el resultado ${i + 1}: ${titleText}`);
                await titleElement.click();
                found = true;
                break;
            }
        }

        if (!found) {
            console.warn('⚠️ No se encontró ningún producto que coincida con el modelo en los primeros resultados.');
            console.log('[4] Seleccionando primer resultado...');
            const firstProduct = page.locator('h3.poly-component__title-wrapper').first();
            await firstProduct.click();
        }

        await page.waitForLoadState('domcontentloaded');

        console.log('[5] Obteniendo título...');
        const title = await page.locator('h1.ui-pdp-title').first().textContent();
        console.log('Título:', title?.trim());

        console.log('[6] Buscando precio...');
        await page.waitForSelector('[data-testid="price-part"] span.andes-money-amount__fraction', { timeout: 10000 });
        let price = await page.locator('[data-testid="price-part"] span.andes-money-amount__fraction').first().textContent();
        console.log('Precio:', price?.trim());

        console.log('[7] Expandiendo especificaciones si es necesario...');
        const expandButton = page.locator('button[data-testid="action-collapsable-target"]');

        if (await expandButton.isVisible()) {
            await expandButton.click();
            await page.waitForTimeout(1000); // Esperar a que se expanda el contenido
            console.log('✔️ Especificaciones expandidas');
        } else {
            console.log('⚠️ Botón de expansión no visible, continuando igual...');
        }

        console.log('[8] Recorriendo especificaciones...');
        let modelMatch = false;

        // Este selector apunta a las filas de todas las tablas visibles bajo "Características"
        const specRows = page.locator('#highlighted_specs_attrs table tr');

        const rowCount = await specRows.count();
        if (rowCount === 0) {
            console.log('⚠️ No se encontraron filas de especificaciones');
        } else {
            for (let i = 0; i < rowCount; i++) {
                const row = specRows.nth(i);
                const key = await row.locator('th, td').first().textContent();
                const value = await row.locator('td span, td').last().textContent();

                const k = key?.trim();
                const v = value?.trim();

                if (k && v) {
                    console.log(`• ${k}: ${v}`);
                    if (v.toLowerCase().includes(model.toLowerCase())) {
                        modelMatch = true;
                    }
                }
            }

            console.log(`¿El modelo coincide en los detalles? ${modelMatch ? '✅ Sí' : '❌ No'}`);
        }

        console.log('✅ Scraping de Mercado Libre finalizado correctamente');
        if (!modelMatch) price = 0
        return { price }
    } catch (error) {
        console.error('❌ Error en scrapMercadoLibre:', error);
    }
};




export const createPage = async () => {
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled'],
        slowMo: 100,
    });

    const context = await browser.newContext({
        locale: 'en-US',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });


    const page = await context.newPage();
    return page
}