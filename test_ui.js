import puppeteer from 'puppeteer';

(async () => {
    console.log("Starting Puppeteer test...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Listen to console logs
    page.on('console', msg => {
        console.log(`[Browser Console] ${msg.type().toUpperCase()} ${msg.text()}`);
    });

    try {
        await page.goto('http://localhost:5173');
        await page.waitForTimeout(2000);

        // Click register
        console.log("Navigating around to see if we can log in...");

        // Try to log in directly if possible, or register
        // Wait for the email input
        await page.waitForSelector('input[type="email"]');
        await page.type('input[type="email"]', 'test_rls_1772624010827@example.com');
        await page.type('input[type="password"]', 'password123');

        // Find the "Entrar" button
        const buttons = await page.$$('button');
        for (let btn of buttons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text.includes('Entrar')) {
                await btn.click();
                break;
            }
        }

        console.log("Waiting for Dashboard...");
        await page.waitForTimeout(4000); // Wait for auth and fetch

        // Go to Postos
        console.log("Going to Postos page...");
        const links = await page.$$('a');
        for (let link of links) {
            const text = await page.evaluate(el => el.textContent, link);
            if (text.includes('Postos / Pátios') || text.includes('Postos')) {
                await link.click();
                break;
            }
        }

        await page.waitForTimeout(2000);

        // Find Edit button
        console.log("Clicking Edit button on first station...");
        const editBtns = await page.$$('button[title="Editar"]');
        if (editBtns.length > 0) {
            await editBtns[0].click();
            await page.waitForTimeout(1000);

            // Just click save
            const saveBtns = await page.$$('button[type="submit"]');
            for (let btn of saveBtns) {
                const text = await page.evaluate(el => el.textContent, btn);
                if (text.includes('Salvar')) {
                    await btn.click();
                    break;
                }
            }

            await page.waitForTimeout(3000);
            console.log("Finished edit flow.");
        } else {
            console.log("No edit buttons found.");
        }

    } catch (err) {
        console.error("Puppeteer Error:", err);
    } finally {
        await browser.close();
    }
})();
