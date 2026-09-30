const fs = require('fs');
const { JSDOM } = require('jsdom');

const SITE_ORIGIN = 'https://alueducation.instructure.com';

// --- Helper: pull a clean "Month Day at HH:MMam/pm" out of Canvas's messy,
// often-duplicated due-date text (e.g. "Due  Sep 11 at 11:59pm Sep 11 at 11:59pm")
function cleanDueDateText(text) {
  if (!text || /no due date/i.test(text)) return 'No due date';

  const match = text.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:\s*at\s*(\d{1,2}:\d{2}\s*[ap]m))?/i);
  if (!match) return text.trim();

  const [, month, day, time] = match;
  return time ? `${month} ${day} at ${time}` : `${month} ${day}`;
}

function scrapeAssignmentsFromFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const dom = new JSDOM(html);

  // Some environments' jQuery build checks for a GLOBAL window before
  // accepting one passed in as an argument. Setting these globals first,
  // then requiring jquery, avoids the "jQuery requires a window with a
  // document" error.
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = { userAgent: 'node.js' };

  const $ = require('jquery');

  const assignments = [];

  $('.ig-row').each(function () {
    const $row = $(this);

    const $titleLink = $row.find('.ig-title');
    const title = $titleLink.text().trim().replace(/\s+/g, ' ');

    // The title itself is usually the clickable link to the assignment
    const href = $titleLink.attr('href');
    const link = href ? new URL(href, SITE_ORIGIN).href : 'No link available';

    const $dueDateEl = $row.find('.assignment-date-due');
    const rawDueDate = $dueDateEl.length ? $dueDateEl.text() : 'No due date';
    const dueDate = cleanDueDateText(rawDueDate);

    const $statusEl = $row.find('.ig-details');
    const status = $statusEl.length
      ? $statusEl.text().trim().replace(/\s+/g, ' ')
      : 'No status info';

    assignments.push({ title, status, dueDate, link });
  });

  return assignments;
}

// --- Run it ---
const assignments = scrapeAssignmentsFromFile('assignments.html');

console.log(`Found ${assignments.length} assignments.\n`);

assignments.forEach((a, i) => {
  console.log(`${i + 1}. ${a.title}`);
  console.log(`   Status:   ${a.status}`);
  console.log(`   Due Date: ${a.dueDate}`);
  console.log(`   Link:     ${a.link}`);
  console.log('');
});