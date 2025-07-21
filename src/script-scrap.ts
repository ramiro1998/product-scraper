import { Browser, chromium } from 'playwright';
import { withRetries } from './utils/dollar';
import { compareTwoStrings } from 'string-similarity';


const SIMILARITY_THRESHOLD = 0.4;
const MAX_SEARCH_RESULTS_TO_CHECK = 15;

export const scrapNewEgg = async (itemNumber: string) => {
    const url = 'https://www.newegg.com/';
    let browserInstance: Browser | null = null;

    const result = await withRetries(async () => {
        const { browser, page } = await createPage();
        browserInstance = browser;

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('div.header2021-search-inner');
            await page.click('input[type="search"]');
            await page.fill('input[type="search"]', itemNumber);
            await page.keyboard.press('Enter');
            await page.waitForSelector('div.price-current');
            await page.waitForSelector('div.tab-navs');

            const price = await page.locator('div.price-current').first().textContent();
            await page.waitForTimeout(1000);
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
            let partNumber = null;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const label = await row.$eval('th', el => el.textContent?.trim());
                const value = await row.$eval('td', el => el.textContent?.trim());

                if (label === 'Brand') brand = value;
                if (label === 'Model') model = value;
                if (label === 'Part Number') partNumber = value;
            }
            return { brand, model, partNumber, price };
        } finally {
            if (browserInstance) {
                await browserInstance.close();
            }
        }
    }, { maxRetries: 2, initialDelayMs: 2000 });

    if (!result) {
        return null;
    }
    return result;
};


export const scrapAmazon = async (brand: string, model: string, partNumber: string | null) => {
    const url = 'https://www.amazon.com/?language=en_US';
    let browserInstance: Browser | null = null;

    const result = await withRetries(async () => {
        const { browser, page } = await createPage();
        browserInstance = browser;

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#twotabsearchtextbox, #nav-bb-search');
            await page.click('input[type="text"]');

            const searchTerm = `${brand} ${model} ${partNumber || ''}`.trim();
            await page.fill('input[type="text"]', searchTerm);
            await page.keyboard.press('Enter');
            await page.waitForSelector('#search', { timeout: 10000 });

            await page.waitForSelector('a.a-link-normal.s-line-clamp-2.s-link-style.a-text-normal', { timeout: 10000 })
                .catch(() => { });

            const productLinks = page.locator('a.a-link-normal.s-line-clamp-2.s-link-style.a-text-normal');
            const productCount = await productLinks.count();

            const noResultsLocator = page.locator('h2 span:has-text("No results for")');
            if (await noResultsLocator.count() > 0 || productCount === 0) {
                return { price: null };
            }

            let productToClick: any = null;
            let productToClickTitle: string | null = null;
            let bestExactMatchScore = -1;
            let bestFuzzyMatchScore = -1;

            let exactMatchFoundInLoop = false;

            for (let i = 0; i < Math.min(MAX_SEARCH_RESULTS_TO_CHECK, productCount); i++) {
                const currentLink = productLinks.nth(i);
                const currentTitle = await currentLink.textContent();

                if (currentTitle) {
                    const currentTitleLower = currentTitle.toLowerCase();
                    const modelLower = model.toLowerCase();
                    const partNumberLower = partNumber?.toLowerCase() || '';

                    const isModelInTitle = modelLower.length > 0 && currentTitleLower.includes(modelLower);
                    const isPartNumberInTitle = partNumberLower.length > 0 && currentTitleLower.includes(partNumberLower);

                    if (isModelInTitle || isPartNumberInTitle) {
                        const currentSimilarity = compareTwoStrings(searchTerm.toLowerCase(), currentTitleLower);

                        if (!exactMatchFoundInLoop || currentSimilarity > bestExactMatchScore) {
                            bestExactMatchScore = currentSimilarity;
                            productToClick = currentLink;
                            productToClickTitle = currentTitle.trim();
                            exactMatchFoundInLoop = true;
                        }
                    }
                }
            }

            if (!productToClick) {
                for (let i = 0; i < Math.min(MAX_SEARCH_RESULTS_TO_CHECK, productCount); i++) {
                    const currentLink = productLinks.nth(i);
                    const currentTitle = await currentLink.textContent();

                    if (currentTitle) {
                        const fuzzySimilarity = compareTwoStrings(searchTerm.toLowerCase(), currentTitle.toLowerCase());

                        if (fuzzySimilarity > bestFuzzyMatchScore) {
                            bestFuzzyMatchScore = fuzzySimilarity;
                            productToClick = currentLink;
                            productToClickTitle = currentTitle.trim();
                        }
                    }
                }

                if (productToClick && bestFuzzyMatchScore < SIMILARITY_THRESHOLD) {
                    productToClick = null;
                }
            }

            if (!productToClick) {
                const firstProduct = page.locator('a.a-link-normal.s-line-clamp-2.s-link-style.a-text-normal').first();
                if (await firstProduct.count() > 0) {
                    productToClick = firstProduct;
                    productToClickTitle = (await firstProduct.textContent())?.trim() || 'Primer Producto';
                } else {
                    return { price: null };
                }
            }

            await productToClick.click();

            await page.waitForLoadState('domcontentloaded');

            const priceLocator = page.locator('.priceToPay').first();
            let price = null;

            try {
                await priceLocator.waitFor({ state: 'visible', timeout: 5000 });
                price = await priceLocator.textContent();
            } catch (error) {
                price = null;
            }

            await page.waitForSelector('#productDetails_detailBullets_sections1', { timeout: 5000 }).catch(() => { });

            const parentSelector = '#prodDetails';
            const parentExists = await page.locator(parentSelector).count();
            let modelMatchInDetails = false;
            if (parentExists !== 0) {
                const tables = page.locator(`${parentSelector} table`);
                const tableCount = await tables.count();

                for (let i = 0; i < tableCount; i++) {
                    const table = tables.nth(i);
                    const rows = table.locator('tr');
                    const rowCount = await rows.count();

                    for (let j = 0; j < rowCount; j++) {
                        const row = rows.nth(j);
                        const key = await row.locator('th').first().textContent();
                        const value = await row.locator('td').first().textContent();

                        const k = key?.trim();
                        const v = value?.trim();

                        if (k && v) {
                            if (v.toLowerCase().includes(model.toLowerCase()) || (partNumber && v.toLowerCase().includes(partNumber.toLowerCase()))) {
                                modelMatchInDetails = true;
                            }
                        }
                    }
                }
            }

            if (!modelMatchInDetails) {
                price = null;
            }
            return { price };
        } finally {
            if (browserInstance) {
                await browserInstance.close();
            }
        }
    }, { maxRetries: 2, initialDelayMs: 2000 });

    if (!result) {
        return null;
    }
    return result;
};


export const scrapMercadoLibre = async (brand: string, model: string, partNumber: string | null) => {
    const url = 'https://www.mercadolibre.com.ar/';
    let browserInstance: Browser | null = null;

    const result = await withRetries(async () => {
        const { browser, page } = await createPage();
        browserInstance = browser;

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            await page.waitForSelector('input[name="as_word"]');

            const searchTerm = `${brand} ${model} ${partNumber || ''}`.trim();
            await page.fill('input[name="as_word"]', searchTerm);
            await page.keyboard.press('Enter');

            await page.waitForSelector('li.ui-search-layout__item');

            const productTitlesElements = page.locator('h3.poly-component__title-wrapper');
            const productCount = await productTitlesElements.count();

            let productToClick: any = null;
            let productToClickTitle: string | null = null;
            let bestExactMatchScore = -1;
            let bestFuzzyMatchScore = -1;

            let exactMatchFoundInLoop = false;

            for (let i = 0; i < Math.min(MAX_SEARCH_RESULTS_TO_CHECK, productCount); i++) {
                const currentTitleElement = productTitlesElements.nth(i);
                const currentTitle = await currentTitleElement.textContent();

                if (currentTitle) {
                    const currentTitleLower = currentTitle.toLowerCase();
                    const modelLower = model.toLowerCase();
                    const partNumberLower = partNumber?.toLowerCase() || '';

                    const isModelInTitle = modelLower.length > 0 && currentTitleLower.includes(modelLower);
                    const isPartNumberInTitle = partNumberLower.length > 0 && currentTitleLower.includes(partNumberLower);

                    if (isModelInTitle || isPartNumberInTitle) {
                        const currentSimilarity = compareTwoStrings(searchTerm.toLowerCase(), currentTitleLower);

                        if (!exactMatchFoundInLoop || currentSimilarity > bestExactMatchScore) {
                            bestExactMatchScore = currentSimilarity;
                            productToClick = currentTitleElement;
                            productToClickTitle = currentTitle.trim();
                            exactMatchFoundInLoop = true;
                        }
                    }
                }
            }

            if (!productToClick) {
                for (let i = 0; i < Math.min(MAX_SEARCH_RESULTS_TO_CHECK, productCount); i++) {
                    const currentTitleElement = productTitlesElements.nth(i);
                    const currentTitle = await currentTitleElement.textContent();

                    if (currentTitle) {
                        const fuzzySimilarity = compareTwoStrings(searchTerm.toLowerCase(), currentTitle.toLowerCase());

                        if (fuzzySimilarity > bestFuzzyMatchScore) {
                            bestFuzzyMatchScore = fuzzySimilarity;
                            productToClick = currentTitleElement;
                            productToClickTitle = currentTitle.trim();
                        }
                    }
                }

                if (productToClick && bestFuzzyMatchScore < SIMILARITY_THRESHOLD) {
                    productToClick = null;
                }
            }

            if (!productToClick) {
                const firstProduct = page.locator('h3.poly-component__title-wrapper').first();
                if (await firstProduct.count() > 0) {
                    productToClick = firstProduct;
                    productToClickTitle = (await firstProduct.textContent())?.trim() || 'Primer Producto';
                } else {
                    return { price: null };
                }
            }

            await productToClick.click();

            await page.waitForLoadState('domcontentloaded');

            const priceLocator = page.locator('[data-testid="price-part"] span.andes-money-amount__fraction').first();
            let price = null;

            try {
                await priceLocator.waitFor({ state: 'visible', timeout: 5000 });
                price = await priceLocator.textContent();
            } catch (error) {
                price = null;
            }

            const expandButton = page.locator('button[data-testid="action-collapsable-target"]');

            if (await expandButton.isVisible()) {
                await expandButton.click();
                await page.waitForTimeout(1000);
            }

            let modelMatchInDetails = false;

            const specRows = page.locator('#highlighted_specs_attrs table tr');

            const rowCount = await specRows.count();
            if (rowCount !== 0) {
                for (let i = 0; i < rowCount; i++) {
                    const row = specRows.nth(i);
                    const key = await row.locator('th, td').first().textContent();
                    const value = await row.locator('td span, td').last().textContent();

                    const k = key?.trim();
                    const v = value?.trim();

                    if (k && v) {
                        if (v.toLowerCase().includes(model.toLowerCase()) || (partNumber && v.toLowerCase().includes(partNumber.toLowerCase()))) {
                            modelMatchInDetails = true;
                        }
                    }
                }
            }

            if (!modelMatchInDetails) {
                price = null;
            }
            return { price };
        } finally {
            if (browserInstance) {
                await browserInstance.close();
            }
        }
    }, { maxRetries: 2, initialDelayMs: 2000 });

    if (!result) {
        return null;
    }
    return result;
};



export const createPage = async () => {
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled'],
        slowMo: 500,
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
    return { browser, page };

}