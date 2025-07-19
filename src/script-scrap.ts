import { chromium } from 'playwright';

export const scrapNewEgg = async (itemNumber: string) => {

    const url = 'https://www.newegg.com/'

    try {

        const page = await createPage()

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('div.header2021-search-inner');
        await page.click('input[type="search"]');
        await page.fill('input[type="search"]', `${itemNumber}`);
        await page.keyboard.press('Enter');
        await page.waitForSelector('div.price-current');
        const price = await page.locator('div.price-current').textContent()

        await page.waitForSelector('div[data-nav="Specs"]');
        const specsTab = page.locator('div[data-nav="Specs"]');
        await specsTab.click();
        await page.waitForSelector('table.table-horizontal');

        const rows = await page.$$('table.table-horizontal tr');

        let brand = null;
        let model = null;

        for (const row of rows) {
            const label = await row.$eval('th', el => el.textContent?.trim());
            const value = await row.$eval('td', el => el.textContent?.trim());

            if (label === 'Brand') {
                brand = value;
            }
            if (label === 'Model') {
                model = value;
            }
        }


        return { brand, model, price, page }

    } catch (error) {

    }
}

export const scrapAmazon = async (brand: string, model: string, page: any) => {

    const url = 'https://www.amazon.com/'

    try {
        // const page = await createPage()

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('div.nav-search-field');
        await page.click('input[type="text"]');
        await page.fill('input[type="text"]', `${brand} ${model}`);
        await page.keyboard.press('Enter');

        // await page.waitForSelector('#search');
        // page.locator('a.a-link-normal.s-line-clamp-2.s-link-style.a-text-normal').first().click();

        // await page.waitForSelector('#titleSection');
        // const title = page.locator('#productTitle').textContent()
        // console.log('title')


    } catch (error) {

    }
}

export const createPage = async () => {
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled'],
        slowMo: 100,
    });

    const context = await browser.newContext({
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });


    const page = await context.newPage();
    return page
}