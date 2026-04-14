// ── WFA Cover Plan — Google Apps Script ──────────────────────────────────────
//
// ── GOOGLE SHEET SETUP (do these steps in order) ─────────────────────────────
//
//   STEP 1 — Set locale to UK (do this before entering any data)
//     File → Settings → Locale → United Kingdom → Save settings
//     Reload the sheet after saving.
//
//   STEP 2 — Create four tabs
//     Rename the first tab: right-click → Rename → type: Plan
//     Add a second tab: click the + button → Rename → type: Events
//     Add a third tab: click the + button → Rename → type: Weeks
//     Add a fourth tab: click the + button → Rename → type: Staff
//
//   STEP 3 — Set up Column A (Date)
//     Select column A → Format → Number → Date
//     Enter dates as DD/MM/YYYY (e.g. 14/04/2026)
//
//   STEP 4 — Set up Column B (Day — auto-fills from date)
//     Select column B → Format → Number → Automatic
//     In cell B2 enter this formula, then drag it down the column:
//       =IF(A2="","",CHOOSE(WEEKDAY(A2,2),"Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"))
//
//   STEP 5 — Add column headers in Row 1 of the Plan tab:
//     A: Date  B: Day  C: Term/Week  D: Session  E: Teacher Out  F: Class  G: Cover Staff  H: Reason  I: Notes  J: Time
//
//   And in Row 1 of the Events tab:
//     A: Start Date  B: End Date  C: Event  D: Notes
//     (End Date can be left blank for single-day events)
//     Example events: Y6 SATs, INSET Day, Bank Holiday, Parents Evening, School Trip (whole school)
//
//   And in Row 1 of the Staff tab:
//     A: Name  B: Role  C: Year Group  D: Status  E: Notes
//     Status is normally blank. Set to "Illness" for long-term absence.
//     Notes: optional free text shown alongside the name in the illness banner (e.g. "Expected return w/c 12 May")
//     Use data validation on Status column: dropdown with values: (blank) | Illness
//
//   And in Row 1 of the Weeks tab:
//     A: Week Start  B: Term  C: Week
//     One row per teaching week — Week Start must be the Monday of that week (DD/MM/YYYY)
//     Example:
//       20/04/2026 | 5 | 1
//       27/04/2026 | 5 | 2
//       04/05/2026 | 5 | 3
//
//   STEP 6 — Make the sheet publicly readable
//     Click Share → Change to "Anyone with the link" → Viewer → Done
//
//   STEP 7 — Note your Sheet ID
//     It's the long string in the URL between /d/ and /edit
//     You'll paste this into the cover plan viewer to connect it.
//
//   STEP 8 — Add this Apps Script
//     Extensions → Apps Script → delete existing code → paste this file → Save
//     Click Run → onOpen once to grant permissions (approve the popup)
//     Reload your sheet — a "Cover Plan" menu appears in the toolbar
//
// ── COLUMN REFERENCE ──────────────────────────────────────────────────────────
//
//   Date        DD/MM/YYYY  (column formatted as Date)
//   Day         Auto-filled by formula (column formatted as Automatic)
//   Session     Must be exactly:  Before School  AM  Lunch  PM  After School
//               Leave blank to mark as All Day (appears in both AM and PM in the viewer)
//   Teacher Out First name of staff member who is out of class
//   Class       e.g. Y4, Reception
//   Cover Staff Who is covering
//   Reason      Must be exactly:  PPA  Leadership  Phase Lead  Training  ECT1  ECT2  RA  Sports  Trip  Illness  Staff Meeting  FLC  PAC  CLF Conference  Other
//               RA = Raising Attainment  |  FLC = Family Learning Conference  |  PAC = Primary Academy Collaboration
//   Time        Optional — free text, e.g. 15:30–18:45. Shown on the card when present.
//   Teacher Out Use "All Staff" for whole-school events (staff meetings, FLC, PAC).
//               These render as a banner rather than individual cover slots.
//   Notes       Optional free text
//
// ── USAGE ─────────────────────────────────────────────────────────────────────
//
//   When you finish updating the plan, click:
//     Cover Plan → Publish & Notify Staff
//   This emails everyone on the NOTIFICATION_EMAILS list with today's cover
//   summary and a link to the viewer.
//
//   To update the email list: edit NOTIFICATION_EMAILS below and save.
//   No other changes needed.
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
