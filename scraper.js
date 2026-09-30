const { chromium } = require('playwright');
const fs = require('fs'); // Built-in Node.js module to write files

const ASSIGNMENTS_URL = 'https://alueducation.instructure.com/courses/3130/assignments';

// --- Helper: pull a clean "Month Day at HH:MMam/pm" string out of Canvas's
// messy due-date text, which often repeats the date twice (once for screen
// readers), like "Due  Sep 11 at 11:59pm Sep 11 at 11:59pm".
function cleanDueDateText(text) {
  if (!text || /no due date/i.test(text)) return 'No due date';

  const match = text.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:\s*at\s*(\d{1,2}:\d{2}\s*[ap]m))?/i);
  if (!match) return text.trim();

  const [, month, day, time] = match;
  return time ? `${month} ${day} at ${time}` : `${month} ${day}`;
}

// --- Helper: turn a cleaned due-date string into a real Date for comparison ---
function parseDueDate(cleanedText) {
  if (!cleanedText || /no due date/i.test(cleanedText)) return null;

  const match = cleanedText.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:\s*at\s*(\d{1,2}:\d{2}\s*[ap]m))?/i);
  if (!match) return null;

  const [, month, day, time] = match;
  const currentYear = new Date().getFullYear();
  const timeStr = time ? ' ' + time.replace(/(am|pm)/i, ' $1').trim() : '';
  let parsed = new Date(`${month} ${day}, ${currentYear}${timeStr}`);

  if (isNaN(parsed.getTime())) return null;

  const now = new Date();
  const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
  if (parsed.getTime() < now.getTime() - sixMonthsMs) {
    parsed = new Date(`${month} ${day}, ${currentYear + 1}${timeStr}`);
  }

  return parsed;
}

async function scrapeALUCanvas() {
  // 1. Launch a normal, visible browser window
  const browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] }); 
  const page = await browser.newPage();

  console.log('Navigating directly to the Assignments page...');
  // Canvas will redirect you to Google login automatically since you're not
  // authenticated yet, then bring you back here once you log in.
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

  await page.waitForLoadState('networkidle').catch(() => {});

  // 2. Locate all assignment rows
  const assignmentRows = await page.locator('.ig-row').all();
  console.log(`Detected ${assignmentRows.length} items. Extracting DOM elements...`);

  const currentAssignments = [];
  const pastDueAssignments = [];

  // 3. Loop through each row to safely pull details
  for (const row of assignmentRows) {
    try {
      const title = await row.locator('.ig-title').innerText();

      const dueDateElement = row.locator('.assignment-date-due');
      const rawDueDateText = (await dueDateElement.count()) > 0
        ? await dueDateElement.innerText()
        : 'No due date';

      const statusElement = row.locator('.submission-status-container');
      const status = (await statusElement.count()) > 0
        ? await statusElement.innerText()
        : 'Not Submitted / Available';

      const cleanedDueDate = cleanDueDateText(rawDueDateText);

      const entry = {
        title: title.trim().replace(/\n/g, ' '),
        dueDate: cleanedDueDate,
        status: status.trim().replace(/\n/g, ' ')
      };

      const parsedDate = parseDueDate(cleanedDueDate);
      const isPastDue = parsedDate !== null && parsedDate.getTime() < Date.now();

      if (isPastDue) {
        pastDueAssignments.push(entry);
      } else {
        currentAssignments.push(entry);
      }
    } catch (error) {
      continue;
    }
  }

  // 4. OUTPUT 1: Visual tables in terminal console
  console.log('\n--- CURRENT / UPCOMING ASSIGNMENTS ---');
  console.table(currentAssignments);

  console.log('\n--- PAST DUE ASSIGNMENTS ---');
  console.table(pastDueAssignments);

  // 5. OUTPUT 2: Export categorized data to a local JSON file
  const outputFilename = 'canvas_assignments.json';
  const jsonString = JSON.stringify(
    { current: currentAssignments, pastDue: pastDueAssignments },
    null,
    2
  );

  fs.writeFileSync(outputFilename, jsonString, 'utf-8');
  console.log(`\nSuccess! Clean JSON dataset saved locally to: ./${outputFilename}`);

  await page.waitForTimeout(5000);
  await browser.close();
}

scrapeALUCanvas();