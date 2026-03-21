const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public/games/hero-quest')));

const server = app.listen(3000, async () => {
    console.log('Server running on port 3000');
    try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
        
        await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });
        
        await browser.close();
    } catch (e) {
        console.error(e);
    } finally {
        server.close();
    }
});