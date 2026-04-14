// ── WFA Cover Plan — Google Apps Script ──────────────────────────────────────
//
// SETUP:
//   1. In your Google Sheet, click Extensions → Apps Script
//   2. Delete any existing code, paste this entire file
//   3. Click Save (disk icon)
//   4. Click Run → onOpen once to authorise (approve the permissions popup)
//   5. Reload your Google Sheet — a new "Cover Plan" menu will appear
//
// USAGE:
//   When you finish updating the plan, click:
//     Cover Plan → Publish & Notify Staff
//   This emails everyone on the NOTIFICATION_EMAILS list and timestamps the update.
//
// ─────────────────────────────────────────────────────────────────────────────

// ── CONFIG — edit these ───────────────────────────────────────────────────────

const VIEWER_URL = 'https://imcl75.github.io/wfa/cover-plan/';

// All staff who should receive the notification email.
// Add or remove addresses as needed.
const NOTIFICATION_EMAILS = [
  // Class teachers
  'jess@wallscourt.clf.school',
  'sarah@wallscourt.clf.school',
  'eloise@wallscourt.clf.school',
  'ellie@wallscourt.clf.school',
  'jo@wallscourt.clf.school',
  'millie@wallscourt.clf.school',
  'jamie@wallscourt.clf.school',
  'reuben@wallscourt.clf.school',
  'innes@wallscourt.clf.school',
  'william@wallscourt.clf.school',
  'laura@wallscourt.clf.school',
  'lutz-mae@wallscourt.clf.school',
  'jon@wallscourt.clf.school',
  'sally@wallscourt.clf.school',
  // Teaching partners
  'alasdair@wallscourt.clf.school',
  'chelsea@wallscourt.clf.school',
  'catherine@wallscourt.clf.school',
  'kerry@wallscourt.clf.school',
  'theresa@wallscourt.clf.school',
  'emmaj@wallscourt.clf.school',
  'hettie@wallscourt.clf.school',
  'sam@wallscourt.clf.school',
  // Regular cover
  'ellen@wallscourt.clf.school',
  'leyla@wallscourt.clf.school',
];

// ─────────────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Cover Plan')
    .addItem('Publish & Notify Staff', 'publishAndNotify')
    .addSeparator()
    .addItem('View plan in browser', 'openViewer')
    .addToUi();
}

function publishAndNotify() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();

  // Stamp "Last Updated" in Config tab (create it if missing)
  let config = ss.getSheetByName('Config');
  if (!config) {
    config = ss.insertSheet('Config');
    config.getRange('A1:B1').setValues([['Last Updated', '']]);
  }
  config.getRange('B1').setValue(now);

  // Build a simple summary of today's cover for the email body
  const plan    = ss.getSheetByName('Plan');
  const today   = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const summary = buildTodaySummary(plan, today);

  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'EEEE d MMMM yyyy');
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm');

  const subject = `Cover plan updated — ${dateStr}`;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#222;">
      <div style="background:#1a1a8c;padding:18px 22px;border-radius:6px 6px 0 0;">
        <h1 style="color:white;font-size:17px;margin:0 0 4px;">Wallscourt Farm Academy</h1>
        <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0;">Cover plan updated at ${timeStr} on ${dateStr}</p>
      </div>
      <div style="border:1px solid #ddd;border-top:none;padding:20px 22px;border-radius:0 0 6px 6px;">
        ${summary}
        <div style="margin-top:20px;">
          <a href="${VIEWER_URL}" style="background:#1a1a8c;color:white;padding:10px 20px;
            border-radius:4px;text-decoration:none;font-size:14px;font-weight:bold;display:inline-block;">
            View full cover plan →
          </a>
        </div>
        <p style="margin-top:16px;font-size:11px;color:#999;">
          This is an automated notification from the WFA Cover Plan.
          The plan updates automatically every 3 minutes — just refresh the page.
        </p>
      </div>
    </div>`;

  MailApp.sendEmail({
    to:       NOTIFICATION_EMAILS.join(','),
    subject:  subject,
    htmlBody: htmlBody,
    body:     `Cover plan updated at ${timeStr}. View it here: ${VIEWER_URL}`,
  });

  SpreadsheetApp.getUi().alert(
    `✓ Plan published\n\nNotification sent to ${NOTIFICATION_EMAILS.length} staff members.`
  );
}

function buildTodaySummary(planSheet, todayStr) {
  if (!planSheet) return '<p style="color:#888;">No Plan sheet found.</p>';

  const data    = planSheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const dateIdx = headers.indexOf('Date');
  const sessIdx = headers.indexOf('Session');
  const outIdx  = headers.indexOf('Teacher Out');
  const classIdx= headers.indexOf('Class');
  const coverIdx= headers.indexOf('Cover Staff');
  const reasonIdx=headers.indexOf('Reason');

  const todayRows = data.slice(1).filter(row => {
    const d = row[dateIdx];
    if (!d) return false;
    const formatted = d instanceof Date
      ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy')
      : String(d).trim();
    return formatted === todayStr;
  });

  if (todayRows.length === 0) return '<p style="color:#64748b;font-size:13px;">No cover arrangements for today.</p>';

  const sessions = ['AM','PM','Lunch'];
  let html = '<p style="font-size:13px;color:#334155;margin:0 0 12px;"><strong>Today\'s cover arrangements:</strong></p>';

  sessions.forEach(session => {
    const rows = todayRows.filter(r => String(r[sessIdx]).trim() === session);
    if (rows.length === 0) return;
    html += `<p style="font-size:12px;font-weight:bold;color:#64748b;margin:10px 0 5px;text-transform:uppercase;letter-spacing:0.05em;">${session}</p>`;
    rows.forEach(r => {
      const out   = r[outIdx]   || '?';
      const cls   = r[classIdx] || '';
      const cover = r[coverIdx] || 'TBC';
      const reason= r[reasonIdx]|| '';
      html += `<div style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:5px;font-size:13px;">
        <strong>${out}</strong>${cls ? ` (${cls})` : ''} → <span style="color:#1a1a8c;font-weight:bold;">${cover}</span>
        ${reason ? `<span style="font-size:11px;color:#64748b;margin-left:6px;">${reason}</span>` : ''}
      </div>`;
    });
  });

  return html;
}

function openViewer() {
  const html = HtmlService.createHtmlOutput(
    `<script>window.open('${VIEWER_URL}','_blank');google.script.host.close();<\/script>`
  ).setWidth(10).setHeight(10);
  SpreadsheetApp.getUi().showModalDialog(html, 'Opening…');
}
