const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
import { Browser, Page } from 'puppeteer';
puppeteer.use(StealthPlugin());

const URLS = {
    LOGGED_IN_0: 'https://learninginmotion.uvic.ca/myAccount/dashboard.htm',
    LOGGED_IN_1: 'https://learninginmotion.uvic.ca/myAccount/co-op/postings.htm',
    LOGGED_OUT: 'https://learninginmotion.uvic.ca/notLoggedIn.htm'
};

const CONFIG = {
    LOGIN: '555',
    PASSWORD: '555',
    COOKIES_PATH: path.resolve(__dirname, 'cookies.json'),
    RESULT_FILE: 'result.json'
};

const fileOps = {
    appendDataToFile: async (filename: string, data: any) => {
        let existingData = [];
        try {
            const fileContents = fs.readFileSync(filename, 'utf-8');
            existingData = JSON.parse(fileContents);
            if (!Array.isArray(existingData)) existingData = [];
        } catch (err) {
            console.log(filename + ' does not exist or is empty');
        }
        const randomArrayName = Math.random().toString(36).substring(7);
        existingData.push({ [randomArrayName]: data });
        fs.writeFileSync(filename, JSON.stringify(existingData, null, 4));
    },

    deleteFile: (filename: string) => {
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
    },

    readCookies: (cookiesPath: string) => {
        if (fs.existsSync(cookiesPath)) {
            return JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        }
        return null;
    },

    writeCookies: (cookiesPath: string, cookies: any) => {
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    }
};

const browserOps = {
    initializeBrowser: async (): Promise<Browser> => {
        return await puppeteer.launch({ headless: true });
    },

    createNewPage: async (browser: Browser): Promise<Page> => {
        return await browser.newPage();
    },

    closeInitialPage: async (browser: Browser) => {
        const pages = await browser.pages();
        if (pages.length > 1) {
            await pages[0].close();
        }
    },

    handleCookies: async (page: Page, cookiesPath: string) => {
        if (fs.existsSync(cookiesPath)) {
            const cookies = fileOps.readCookies(cookiesPath);
            await page.setCookie(...cookies);
        }
    }
};

const pageOps = {
    waitAndClickSelector: async (page: Page, selector: string, timeout = 5000) => {
        await page.waitForSelector(selector, { visible: true, timeout });
        await page.click(selector);
    },

    clickTermLink: async (page: Page) => {
        await page.evaluate(() => {
            const link = Array.from(document.querySelectorAll('a')).find(el => el.innerText.includes('2024 - Fall'));
            if (link) link.click();
        });
    },

    openLinkInNewPage: async (browser: Browser, element: any): Promise<Page> => {
        const [newPage] = await Promise.all([
            new Promise<Page>(resolve =>
                browser.once('targetcreated', async target => {
                    const newPage = await target.page();
                    if (newPage) resolve(newPage);
                })
            ),
            element.$eval('a[class^="np-view-btn-"]', (anchor: HTMLAnchorElement) => anchor.click())
        ]);
        return newPage;
    },

    extractData: async (page: Page) => {
        return page.evaluate(() => {
            const result = {};
            const rows = Array.from(document.querySelectorAll('.panel.panel-default .panel-body table tbody tr'));

            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const key = cells[0]?.innerText?.trim().replace(/:/g, '');
                    const value = cells[1]?.innerText?.trim().replace(/:/g, '');
                    if (key) {
                        result[key] = value ?? "N/A";
                    }
                }
            }

            return result;
        }, { timeout: 5000 });
    }
};

const loginOps = {
    handleLogin: async (page: Page, login: string, password: string, cookiesPath: string): Promise<boolean> => {
        try {
            const studentsLink = await page.waitForSelector('a[href="/students/NetlinkID/student-login.htm"]');
            if (studentsLink) { await studentsLink.click(); }

            await page.waitForSelector('input[name="username"]');
            await page.type('input[name="username"]', login);
            await new Promise(resolve => setTimeout(resolve, 500));
            await page.type('input[name="password"]', password);
            await page.click('.mdc-button__label');

            const maxAttempts = 10;
            for (let attempts = 0; attempts < maxAttempts; attempts++) {
                await new Promise(resolve => setTimeout(resolve, 300));
                try {
                    await pageOps.waitAndClickSelector(page, '#dont-trust-browser-button', 5000);
                } catch (error) {
                    const errorMessage = await page.evaluate(() => {
                        const element = document.querySelector('.prompt4-header-text-with-icon');
                        return element ? element.textContent : '';
                    });
                    if (errorMessage && errorMessage.trim() === 'Login denied') {
                        console.log('Error: Login denied');
                        return false;
                    }
                }
                if (page.url() === URLS.LOGGED_IN_0 || page.url() === URLS.LOGGED_IN_1) {
                    const cookies = await page.cookies();
                    fileOps.writeCookies(cookiesPath, cookies);
                    return true;
                }
            }
            throw new Error('Login failed after maximum attempts');
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }
};

const processPostings = async (browser: Browser, page: Page) => {
    await page.goto(URLS.LOGGED_IN_1);
    await pageOps.clickTermLink(page);
    await page.waitForSelector('tbody');
    await new Promise(resolve => setTimeout(resolve, 100000));
    const rows = await page.$$('tbody tr');

    const totalRows = rows.length;
    console.log(`Total rows: ${totalRows}`);

    for (let i = 0; i < totalRows; i++) {
        const row = rows[i];
        console.log(`Processing row ${i + 1} of ${totalRows}`);

        try {
            const [newPage] = await Promise.all([
                new Promise<Page>(resolve =>
                    browser.once('targetcreated', async target => {
                        const newPage = await target.page();
                        if (newPage) resolve(newPage);
                    })
                ),
                row.$eval('a[class^="np-view-btn-"]', (anchor: HTMLAnchorElement) => anchor.click())
            ]);

            try {
                await newPage.waitForSelector('.panel.panel-default .panel-body', { timeout: 5000 });
                await new Promise(resolve => setTimeout(resolve, 10000));
                const data = await pageOps.extractData(newPage);
                await fileOps.appendDataToFile(CONFIG.RESULT_FILE, data);
                console.log('[ Data appended ]');
            } catch (error) {
                console.error('Error processing page:', error);
            } finally {
                await newPage.close();
            }
        } catch (error) {
            console.error('Error processing row:', error);
        }
    }
};

const main = async () => {
    fileOps.deleteFile(CONFIG.RESULT_FILE);

    const browser = await browserOps.initializeBrowser();
    const page = await browserOps.createNewPage(browser);

    await browserOps.closeInitialPage(browser);
    await browserOps.handleCookies(page, CONFIG.COOKIES_PATH);
    await page.goto(URLS.LOGGED_IN_0);

    if (page.url() === URLS.LOGGED_OUT) {
        await loginOps.handleLogin(page, CONFIG.LOGIN, CONFIG.PASSWORD, CONFIG.COOKIES_PATH);
    }
    await processPostings(browser, page);
    await browser.close();
};

main();