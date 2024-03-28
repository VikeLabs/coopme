// const puppeteer = require('puppeteer');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import { Browser } from 'puppeteer';
puppeteer.use(StealthPlugin());

const URL = 'https://learninginmotion.uvic.ca/myAccount/co-op/postings.htm'
const LOGIN = 'test'
const PASSWORD = 'test'

const main = async () => {
    const browser: Browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const pages = await browser.pages();
    if (pages.length > 1) { await pages[0].close(); }
    await page.goto(URL);

    if (page.url() === 'https://learninginmotion.uvic.ca/notLoggedIn.htm') {
        const studentsLink = await page.waitForSelector('a[href="/students/NetlinkID/student-login.htm"]');
        if (studentsLink) { await studentsLink.click(); }
        await page.waitForSelector('input[name="username"]');
        await page.type('input[name="username"]', LOGIN);
        await new Promise(resolve => setTimeout(resolve, 500));
        await page.type('input[name="password"]', PASSWORD);
        await page.click('#form-submit')
        while (1) {
            await new Promise(resolve => setTimeout(resolve, 300));
            try {
                await page.waitForSelector('#dont-trust-browser-button', { visible: true, timeout: 5000 });
                await page.click('#dont-trust-browser-button');
            } catch (error) {
                const errorMessage = await page.evaluate(() => {
                    const element = document.querySelector('.prompt4-header-text-with-icon');
                    return element ? element.textContent : '';
                });
                if (errorMessage && errorMessage.trim() === 'Login denied') {
                    console.log('Error: Login denied');
                    await browser.close();
                }
            }
            if (page.url() === 'https://learninginmotion.uvic.ca/myAccount/dashboard.htm') { break; }
        }
    } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await browser.close();
}
main()