const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import { Browser } from 'puppeteer';
puppeteer.use(StealthPlugin());

const URL = 'https://learninginmotion.uvic.ca/myAccount/co-op/postings.htm'
const LOGIN = 'uvic_netlink_id'
const PASSWORD = 'password_uvic_netlink_id'

/**
 * Function that logs into the Learning in Motion website and navigates
 * to the Co-op postings page
 */
const main = async () => {
    const browser: Browser = await puppeteer.launch({ headless: true });                                        // Launch ChromiumTest browser
    const page = await browser.newPage();                                                                       // Create a new page
    const pages = await browser.pages();                                                                        // Get all open pages
    if (pages.length > 1) { await pages[0].close(); }                                                           // Close the first page if it is not the login page
    await page.goto(URL);                                                                                       // Navigate to the main page

    if (page.url() === 'https://learninginmotion.uvic.ca/notLoggedIn.htm') {                                    // If the user is not logged in, navigate to the login page
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
            if (page.url() === 'https://learninginmotion.uvic.ca/myAccount/dashboard.htm') { break; }           // If the user is logged in, break the loop
        }
    } else { await new Promise(resolve => setTimeout(resolve, 5000)); }                                         // If the user is already logged in, wait for 5 seconds
    await browser.close();                                                                                      // closes the ChromiumTest browser
}
main()