import { chromium } from 'playwright';
import { withRetries } from './utils/dollar';

export const scrapNewEgg = async (itemNumber: string) => {
    const url = 'https://www.newegg.com/';
    let browser = null;

    const result = await withRetries(async () => {
        const { browser: newBrowser, page } = await createPage();
        browser = newBrowser;
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

            /* loogking brand and model */
            for (const row of rows) {
                const label = await row.$eval('th', el => el.textContent?.trim());
                const value = await row.$eval('td', el => el.textContent?.trim());

                if (label === 'Brand') brand = value;
                if (label === 'Model') model = value;
            }

            return { brand, model, price };
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }, { maxRetries: 2, initialDelayMs: 2000 });

    if (!result) {
        console.error('NewEgg scraping failed after many attempts.');
        return null;
    }
    return result;
};


export const scrapAmazon = async (brand: string, model: string) => {
    const url = 'https://www.amazon.com/?language=en_US';
    let browserInstance = null;

    const result = await withRetries(async () => {
        const { browser, page } = await createPage();
        browserInstance = browser;

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#twotabsearchtextbox, #nav-bb-search');
            await page.click('input[type="text"]');
            const searchTerm = `${brand} ${model}`;

            await page.fill('input[type="text"]', searchTerm);
            await page.keyboard.press('Enter');
            await page.waitForSelector('#search', { timeout: 10000 });

            const noResultsLocator = page.locator('h2 span:has-text("No results for")');
            let price;
            if (await noResultsLocator.count() > 0) {
                price = '0';
                return { price };
            }
            const firstProduct = page.locator('a.a-link-normal.s-line-clamp-2.s-link-style.a-text-normal').first();
            await firstProduct.click();

            await page.waitForLoadState('domcontentloaded');

            await page.waitForSelector('span.a-price span.a-offscreen', { timeout: 5000 });
            price = await page.locator('span.a-price span.a-offscreen').first().textContent();

            const title = await page.locator('span#productTitle').first().textContent();
            if (title?.toLowerCase().includes(model.toLowerCase())) {
                return { price };
            }

            await page.waitForSelector('#prodDetails', { timeout: 5000 });

            const parentSelector = '#prodDetails';

            const parentExists = await page.locator(parentSelector).count();
            let modelMatch = false;
            if (parentExists === 0) {
                console.log('#prodDetails not found');
            } else {
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
                            if (v.toLowerCase().includes(model.toLowerCase())) {
                                console.log(`• ${k}: ${v}`);
                                modelMatch = true;
                            }
                        }
                    }
                }

            }
            console.log('Scraping Amazon finished!');
            if (!modelMatch) price = '0';
            return { price };
        } finally {
            if (browserInstance) {
                await browserInstance.close();
            }
        }
    }, { maxRetries: 2, initialDelayMs: 2000 });

    if (!result) {
        console.error('Amazon scraping failed after many attempts.');
    }
    return result;
};


export const scrapMercadoLibre = async (brand: string, model: string) => {
    const url = 'https://www.mercadolibre.com.ar/';
    let browserInstance = null;

    const result = await withRetries(async () => {
        const { browser, page } = await createPage();
        browserInstance = browser;

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            await page.waitForSelector('input[name="as_word"]');

            const searchTerm = `${brand} ${model}`;
            await page.fill('input[name="as_word"]', searchTerm);
            await page.keyboard.press('Enter');

            await page.waitForSelector('li.ui-search-layout__item');

            const productTitles = page.locator('h3.poly-component__title-wrapper');
            const count = await productTitles.count();

            let found = false;

            for (let i = 0; i < Math.min(10, count); i++) {
                const titleElement = productTitles.nth(i);
                const titleText = (await titleElement.textContent())?.toLowerCase();

                if (titleText?.includes(model.toLowerCase())) {
                    await titleElement.click();
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.warn('Model not found in first 10 listed products (reading title), then first is selected.');
                const firstProduct = page.locator('h3.poly-component__title-wrapper').first();
                await firstProduct.click();
            }

            await page.waitForLoadState('domcontentloaded');

            await page.waitForSelector('[data-testid="price-part"] span.andes-money-amount__fraction', { timeout: 10000 });
            let price = await page.locator('[data-testid="price-part"] span.andes-money-amount__fraction').first().textContent();

            const title = await page.locator('h1.ui-pdp-title').first().textContent();

            if (title?.toLowerCase().includes(model.toLowerCase())) {
                return { price };
            }

            const expandButton = page.locator('button[data-testid="action-collapsable-target"]');

            if (await expandButton.isVisible()) {
                await expandButton.click();
                await page.waitForTimeout(1000);
            }

            let modelMatch = false;

            const specRows = page.locator('#highlighted_specs_attrs table tr');

            const rowCount = await specRows.count();
            if (rowCount === 0) {
                console.log('Spec rows not found');
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

            }
            console.log('MercadoLibre scraping finished');
            if (!modelMatch) price = '0';
            return { price };
        } finally {
            if (browserInstance) {
                await browserInstance.close();
            }
        }
    }, { maxRetries: 2, initialDelayMs: 2000 });

    if (!result) {
        console.error('MercadoLibre scraping failed after many attempts.');
    }
    return result;
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
    return { browser, page };

}