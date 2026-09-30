const { chromium } = require('playwright');
const fs = require('fs');

const ASSIGNMENTS_URL = 'https://alueducation.instructure.com/courses/3130/assignments';

async function fetchAssignmentsHtml() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage();

  console.log('Navigating directly to the Assignments page...');
  await page.goto(ASSIGNMENTS_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('\n======================================================');
  console.log('ACTION REQUIRED: Please log in using your student Google account.');
  console.log('Complete any 2FA prompts on your mobile device if required.');
  console.log('======================================================\n');

  await page.waitForURL(
    (url) => url.href.startsWith(ASSIGNMENTS_URL),
    { timeout: 0 }
  );
  console.log('Login verified! Arrived at the Assignments page.');

  // Make sure the assignment rows have actually rendered before saving
  await page.waitForSelector('.ig-row', { timeout: 30000 }).catch(() => {
    console.log('Warning: .ig-row never appeared \u2014 saving whatever loaded anyway.');
  });
  await page.waitForLoadState('networkidle').catch(() => {});

  const html = await page.content();
  fs.writeFileSync('assignments.html', html, 'utf-8');
  console.log('\nSaved the fully-rendered page to assignments.html');

  await browser.close();
}

fetchAssignmentsHtml();