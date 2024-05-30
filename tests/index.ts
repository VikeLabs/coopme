const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
import { Browser, Page } from 'puppeteer';
puppeteer.use(StealthPlugin());

const LOGGED_IN_URL_0 = 'https://learninginmotion.uvic.ca/myAccount/dashboard.htm'
const LOGGED_IN_URL_1 = 'https://learninginmotion.uvic.ca/myAccount/co-op/postings.htm'
const LOGGED_OUT_URL = 'https://learninginmotion.uvic.ca/notLoggedIn.htm'
const LOGIN = 'uvic-username'
const PASSWORD = 'uvic-password'
const COOKIES_PATH = path.resolve(__dirname, 'cookies.json');


async function appendDataToFile(filename, data) {
    let existingData = [];
    try {
        const fileContents = fs.readFileSync(filename, 'utf-8');
        existingData = JSON.parse(fileContents);
        if (!Array.isArray(existingData)) {
            existingData = [];
        }
    } catch (err) {
        // File does not exist or is empty
    }
    const randomArrayName = Math.random().toString(36).substring(7); // Generate random array name
    existingData.push({ [randomArrayName]: data });
    fs.writeFileSync(filename, JSON.stringify(existingData, null, 4));
}


/**
 * Function that logs into the Learning in Motion website and navigates
 * to the Co-op postings page
 */
const main = async () => {
    const browser: Browser = await puppeteer.launch({ headless: true });                                        // Launch ChromiumTest browser
    const page = await browser.newPage();                                                                       // Create a new page
    const pages = await browser.pages();                                                                        // Get all open pages
    if (pages.length > 1) { await pages[0].close(); }                                                           // Close the first page if it is not the login page

    if (fs.existsSync(COOKIES_PATH)) {                                                                          // If the cookies file exists
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));                                      // Read the cookies from the file
        await page.setCookie(...cookies);                                                                       // Set the cookies on the page
    }

    await page.goto(LOGGED_IN_URL_0);                                                                           // Navigate to the main page

    if (page.url() === LOGGED_OUT_URL) {                                                                        // If the user is not logged in, navigate to the login page
        const studentsLink = await page.waitForSelector('a[href="/students/NetlinkID/student-login.htm"]');     // Find the link to the student login page
        if (studentsLink) { await studentsLink.click(); }                                                       // If the link exists, click it
        await page.waitForSelector('input[name="username"]');                                                   // Wait for the username input field to load
        await page.type('input[name="username"]', LOGIN);                                                       // Type the user's login credentials
        await new Promise(resolve => setTimeout(resolve, 500));                                                 // Wait half a second
        await page.type('input[name="password"]', PASSWORD);
        await page.click('#form-submit')                                                                        // Click the submit button

        while (1) {                                                                                             // Loop until the user is logged in or an error occurs
            await new Promise(resolve => setTimeout(resolve, 300));                                             // Wait for 300ms
            try {                                                                                               // Try to find the "Login denied" error message
                await page.waitForSelector('#dont-trust-browser-button', { visible: true, timeout: 5000 });     // Wait for the button to load and be visible
                await page.click('#dont-trust-browser-button');                                                 // Click the button
            } catch (error) {                                                                                   // If the button is not found or times out
                const errorMessage = await page.evaluate(() => {                                                // Get the error message (if any)
                    const element = document.querySelector('.prompt4-header-text-with-icon');
                    return element ? element.textContent : '';
                });
                if (errorMessage && errorMessage.trim() === 'Login denied') {                                   // If the error message is "Login denied", break the loop
                    console.log('Error: Login denied');
                    break;
                }
            }

            if (page.url() === LOGGED_IN_URL_0 || page.url() === LOGGED_IN_URL_1) {                             // If the user is logged in
                const cookies = await page.cookies();                                                           // Save cookies after successful login
                fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));                               // Write the cookies to the file
                break;                                                                                          // If the user is logged in, break the loop
            }
        }
    } else {
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        await page.goto(LOGGED_IN_URL_1);

        page.evaluate(() => {
            const link = Array.from(document.querySelectorAll('a')).find(el => el.innerText.includes('2024 - Fall'));
            if (link) link.click();
        });

        await page.waitForSelector('tbody');
        const rows = await page.$$('tbody tr');

        for (const row of rows) {
            const [newPage] = await Promise.all([
                new Promise<Page>(resolve =>
                    browser.once('targetcreated', async target => {
                        const newPage = await target.page();
                        if (newPage) resolve(newPage);
                    })
                ),
                row.$eval('a[class^="np-view-btn-"]', (anchor: HTMLAnchorElement) => anchor.click())
            ]);

            await newPage.waitForSelector('.panel.panel-default .panel-body');

            const data = await newPage.evaluate(() => {
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
            });

            page.waitForNavigation({ waitUntil: 'networkidle0' });
            await appendDataToFile('result.json', data);
            console.log('[ Data appended ]');
            await newPage.close();
        }
    }
    await browser.close();
}
main()
