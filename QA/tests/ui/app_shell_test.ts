/**
 * @ui @smoke
 * S-105 UI test for the Asimov HR web shell (new frontend).
 *
 * The shell sits behind sign-in, but the suite signs in ONCE: the first
 * scenario drives the real /signin form with the QA account from QA/.env
 * (TEST_USERNAME / TEST_PASSWORD) and the browser session is kept between
 * scenarios (keepBrowserState in codecept.conf.ts). Every later scenario
 * reuses that session and only falls back to logging in when it has to run
 * on its own (grep, retries). The public careers pages need no session.
 *
 * Destructive scenarios (invite, role change, remove, approve) start from the
 * mock's seed data: a Before hook calls POST /__reset on the mock API so the
 * tests stay repeatable across runs. The mock URL mirrors VITE_API_URL from
 * the frontend's .env.local and can be overridden with QA_MOCK_API_URL.
 *
 * Selectors use accessible roles/names, stable ids and attributes only.
 * No generated CSS class names.
 */
import { strict as assert } from 'node:assert'
import { testPassword, testUsername } from '../support/env'

Feature('Asimov HR web shell @ui')

/** The mock API the browser talks to (VITE_API_URL in the frontend .env.local). */
const mockApi = process.env.QA_MOCK_API_URL || 'http://127.0.0.1:3000'

/** Every scenario starts from the mock's seed data (users, approvals, templates). */
Before(async () => {
  const response = await fetch(`${mockApi}/__reset`, { method: 'POST' })
  assert.ok(response.ok, `mock /__reset failed with HTTP ${response.status}`)
})

/** True once this worker holds a signed-in browser session. */
let sessionEstablished = false

/** Drives the real sign-in form. Used by the login test and as a fallback. */
async function loginThroughForm(I: CodeceptJS.I): Promise<void> {
  assert.ok(testUsername, 'TEST_USERNAME must be set in QA/.env')
  assert.ok(testPassword, 'TEST_PASSWORD must be set in QA/.env')

  I.amOnPage('/signin')
  I.waitForText('Sign in', 15, 'h1')
  I.fillField('Email', testUsername)
  I.fillField('Password', testPassword)
  I.click('button[type="submit"]')
  I.waitForText('Home', 20, 'h1')

  sessionEstablished = true
}

/**
 * Starts the shell with no second login: the session saved by the login test
 * is still in the browser. Only logs in when this worker has no session yet.
 */
async function ensureSignedIn(I: CodeceptJS.I): Promise<void> {
  if (!sessionEstablished) return loginThroughForm(I)

  I.amOnPage('/')
  I.waitForText('Home', 15, 'h1')
}

/** Selects a profile tab by its visible title (the shell renders role="tab" buttons). */
function selectProfileTab(I: CodeceptJS.I, title: string): void {
  I.click(`button[role="tab"]:has-text("${title}")`)
}

Scenario('signs in with the QA account @ui @smoke', async ({ I }) => {
  await loginThroughForm(I)

  I.waitForElement('header', 15)
  // The signed-in account is resolved from the API, not hard-coded in the UI.
  I.see(testUsername)
  I.see('Sign out')
})

Scenario('application shell renders its navigation @ui @smoke', async ({ I }) => {
  await ensureSignedIn(I)

  I.waitForElement('header', 15)
  I.seeElement('nav')
  I.seeElement('aside')
  I.see('Sign out')

  // Every module the shell advertises must be reachable from the sidebar.
  const hrefs = await I.grabAttributeFromAll('aside a', 'href')
  for (const expected of ['/talently', '/people', '/onboard', '/time', '/settings']) {
    assert.ok(
      hrefs.includes(expected),
      `sidebar should link to ${expected}, got ${JSON.stringify(hrefs)}`,
    )
  }
})

Scenario('each module route renders its own heading @ui @smoke', async ({ I }) => {
  await ensureSignedIn(I)

  // Direct navigation per route: each module must render its i18n title.
  // /talently, /people and /settings redirect to their first sub-route.
  const routes = [
    ['/', 'Home'],
    ['/talently', 'Templates'],
    ['/people', 'Employee directory'],
    ['/onboard', 'Onboard'],
    ['/time', 'Time'],
    ['/settings', 'Users'],
  ] as const

  for (const [route, heading] of routes) {
    I.amOnPage(route)
    I.waitForText(heading, 15, 'h1')
  }
})

Scenario('careers page lists the open and the closed role @ui @smoke', async ({ I }) => {
  // The public careers site must work without a session.
  I.amOnPage('/careers')
  I.waitForText('Open roles', 15, 'h1')

  I.see('Frontend Engineer')
  I.see('Chennai · Full-time')
  I.see('Product Designer')
  I.see('Remote · Contract')
  I.see('Closed')

  I.seeElement('a[href="/careers/j1"]')
  I.seeElement('#tenant-logo')
  I.see('Careers', 'header')
})

Scenario('closed job explains that applications are closed @ui', async ({ I }) => {
  I.amOnPage('/careers/j2')
  I.waitForText('This role is closed', 15, '[role="alert"]')

  I.see('Product Designer', 'h1')
  I.see('See open roles')
  I.seeElement('[role="alert"]')
  I.dontSee('Apply for this role')
  I.dontSee('Submit application')
})

Scenario('apply form reports what is missing @ui @smoke', async ({ I }) => {
  I.amOnPage('/careers/j1')
  I.waitForText('Apply for this role', 15, 'h2')

  I.click('Submit application')

  I.see('This field is required.')
  I.see('Please add your resume.')
  I.see('You must agree to continue.')
  I.seeElement('[aria-invalid="true"]')
  I.seeElement('[role="alert"]')

  // Nothing is sent while the form is incomplete.
  const url = await I.grabCurrentUrl()
  assert.ok(url.endsWith('/careers/j1'), `submit must stay on the form, got ${url}`)
})

Scenario('a complete application is submitted @ui @smoke', async ({ I }) => {
  I.amOnPage('/careers/j1')
  I.waitForText('Apply for this role', 15, 'h2')

  I.fillField('Full name', 'QA Candidate')
  I.fillField('Email', 'qa.candidate@example.com')
  I.fillField('Phone', '+91 98765 43210')
  I.fillField('Why do you want this role?', 'I build the QA suite for this product.')
  I.checkOption('Hybrid')
  I.checkOption('Yes')
  I.fillField('Years of React experience', '5')
  I.click({ css: '[aria-label="Rating 4 of 5"]' })

  I.attachFile({ css: 'input[type="file"]' }, 'tests/data/resume.pdf')
  I.waitForText('Selected file: resume.pdf', 10)

  I.checkOption('I agree to the processing')
  I.seeCheckboxIsChecked('I agree to the processing')

  I.click('Submit application')
  I.waitForText('Application received', 20, 'h1')
  I.see('What happens next')
  I.see('Our team reviews your application.')
  I.see('See open roles')

  const url = await I.grabCurrentUrl()
  assert.ok(url.endsWith('/careers/j1/success'), `expected the success page, got ${url}`)
})

Scenario('people directory search narrows the list @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/people/directory')
  I.waitForText('Employee directory', 15, 'h1')
  I.waitForText('Showing 1 to 20 of 47', 15, '[role="status"]')

  // The search matches on the employee code, page and count follow.
  I.fillField('Search by name or employee code', 'AS-1001')
  I.waitForText('Showing 1 to 1 of 1', 20, '[role="status"]')
  I.see('Code AS-1001')
  I.dontSee('Code AS-1002')

  I.fillField('Search by name or employee code', '')
  I.waitForText('Showing 1 to 20 of 47', 20, '[role="status"]')

  // Several seeded employees share a name (the list wraps): all must be
  // listed, told apart by their employee code.
  I.fillField('Search by name or employee code', 'Priya Sharma')
  I.waitForText('Showing 1 to 4 of 4', 20, '[role="status"]')
  I.see('Code AS-1016')
  I.see('Code AS-1017')
  I.see('Code AS-1040')
  I.see('Code AS-1041')
})

Scenario('people profile opens from the directory and back returns to the search @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/people/directory?q=AS-1002')
  I.waitForText('Showing 1 to 1 of 1', 15, '[role="status"]')
  I.click('Ben Thomas')
  I.waitForText('Ben Thomas', 15, 'h1')

  const url = await I.grabCurrentUrl()
  assert.ok(url.includes('/people/e2'), `expected /people/e2, got ${url}`)

  // Header, tabs and the overview fields of the profile.
  I.see('Design Lead')
  I.see('Remote · Design')
  I.seeElement('[role="tablist"][aria-label="Profile sections"]')
  I.see('Documents', '[role="tab"]')
  I.see('Sensitive', '[role="tab"]')
  I.waitForElement('section[aria-label="Overview"]', 10)
  I.see('Employee code', 'dt')
  I.see('AS-1002', 'dd')
  I.see('ben.thomas.2@example.com')
  I.see('Active')

  // Back keeps the list exactly as it was left.
  I.click('Back to directory')
  I.waitForText('Employee directory', 15, 'h1')
  I.waitForText('Showing 1 to 1 of 1', 15, '[role="status"]')
  I.seeInField('Search by name or employee code', 'AS-1002')
})

Scenario('profile job tab shows the employment details @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/people/e2')
  I.waitForText('Ben Thomas', 15, 'h1')
  I.waitForElement('section[aria-label="Overview"]', 10)

  selectProfileTab(I, 'Job')
  I.waitForElement('section[aria-label="Job"]', 10)

  const url = await I.grabCurrentUrl()
  assert.ok(url.includes('tab=job'), `expected tab=job in the URL, got ${url}`)

  I.see('Reports to', 'dt')
  I.see('Divya R', 'dd')
  I.see('Joining date', 'dt')
  I.see('7 Nov 2020', 'dd')
  I.see('Employment type', 'dt')
  I.see('Full-time', 'dd')
  I.see('Grade', 'dt')
  I.see('G5', 'dd')
  I.dontSee('Exit date')
})

Scenario('profile documents upload, open and delete with an audit trail @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/people/e2?tab=documents')
  I.waitForText('Ben Thomas', 15, 'h1')
  I.waitForElement('section[aria-label="Documents"]', 15)

  // Seeded documents with their metadata and the link-expiry note.
  I.see('Offer letter.pdf')
  I.see('ID proof.pdf')
  I.see('uploaded by hr@example.com')
  I.see('PDF, PNG, JPG or DOCX, up to 10 MB.')
  I.see('Links stop working after about a minute.')

  // Upload: the new document appears with the signed-in account as uploader.
  I.attachFile({ css: 'input[type="file"]' }, 'tests/data/resume.pdf')
  I.waitForText('resume.pdf', 15)
  I.see(`uploaded by ${testUsername}`)

  // A file of the wrong type is rejected before anything is sent.
  I.attachFile({ css: 'input[type="file"]' }, 'tests/data/notes.txt')
  I.waitForText('Choose a PDF, PNG, JPG or DOCX file.', 10, '[role="alert"]')

  // Open asks the API for an expiring link; the audit log records it.
  I.click('Open', { css: 'li:has-text("Offer letter.pdf")' })

  // Delete asks for confirmation, then the document is gone.
  I.click('Delete', { css: 'li:has-text("resume.pdf")' })
  I.waitForText('Delete resume.pdf? This cannot be undone.', 10, '[role="alertdialog"]')
  I.click('Yes, delete')
  I.waitForInvisible({ css: 'li:has-text("resume.pdf")' }, 15)
  I.dontSee('resume.pdf')
  I.see('Offer letter.pdf')

  // The activity tab shows every step of the trail, newest first.
  selectProfileTab(I, 'Activity')
  I.waitForElement('section[aria-label="Activity"]', 10)
  I.see('Document deleted')
  I.see('Document opened')
  I.see('Document uploaded')
  I.see('Offer letter.pdf')
  I.see(testUsername)
})

Scenario('profile sensitive tab shows HR-only details and records the view @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/people/e2?tab=sensitive')
  I.waitForText('Ben Thomas', 15, 'h1')
  I.waitForElement('section[aria-label="Sensitive"]', 15)

  I.see('Only HR can see this tab. Each view is recorded in the activity log.')
  I.see('Date of birth', 'dt')
  I.see('15 Mar 1987', 'dd')
  I.see('ben.thomas.2@personal.example.org')
  I.see('Family contact 2 (Spouse)')
  I.see('Account ending 1074')
  I.see('Band 3', 'dd')

  // Opening the tab is itself recorded in the audit log.
  selectProfileTab(I, 'Activity')
  I.waitForElement('section[aria-label="Activity"]', 10)
  I.see('Sensitive details viewed')
  I.see(testUsername)
})

Scenario('exited employee profile is read-only @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/people/e1?tab=documents')
  I.waitForText('Asha Rao', 15, 'h1')

  // The badge, the read-only note and no upload form for an exited employee.
  I.see('Exited')
  I.see('This employee has exited. The profile is read-only.', '[role="note"]')
  I.waitForElement('section[aria-label="Documents"]', 15)
  I.dontSee('Upload a document')
  I.see('No documents yet.')

  // The job tab carries the exit date.
  selectProfileTab(I, 'Job')
  I.waitForElement('section[aria-label="Job"]', 10)
  I.see('Exit date', 'dt')
  I.see('30 Sep 2026', 'dd')
})

Scenario('member role only sees the overview and job tabs @ui', async ({ I }) => {
  await ensureSignedIn(I)

  // The mock signs the session as a member: documents, activity and
  // sensitive must not even be rendered. The Before hook restores
  // the owner role for the next scenario.
  const response = await fetch(`${mockApi}/__role/member`)
  assert.ok(response.ok, `__role/member failed with HTTP ${response.status}`)

  I.amOnPage('/people/e2?tab=sensitive')
  I.waitForText('Ben Thomas', 15, 'h1')

  // An invisible tab falls back to Overview instead of showing nothing.
  I.waitForElement('section[aria-label="Overview"]', 10)
  const tabs = await I.grabTextFromAll('[role="tab"]')
  assert.deepEqual(tabs, ['Overview', 'Job'], `unexpected tabs for a member: ${JSON.stringify(tabs)}`)
  I.dontSee('Sensitive')
  I.dontSee('Only HR can see this tab')
  I.see('ben.thomas.2@example.com')
})

Scenario('talently saves a new template through the editor @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/talently/templates')
  I.waitForText('Templates', 15, 'h1')
  I.see('Frontend screening')

  I.click('New template')
  I.waitForText('New template', 15, 'h1')

  I.fillField('Template name', 'QA smoke template')
  I.click('Add question')
  I.waitForText('Question 1', 10, 'legend')
  I.fillField('Question text', 'Years of React experience')
  I.fillField('Weight', '100')

  // Save unlocks once the template validates: name, question text, weights 100.
  I.click('Save')
  I.waitForText('Templates', 15, 'h1')
  I.see('QA smoke template')
  I.see('Version 1 · 1 questions')
})

Scenario('settings invites, re-roles and removes a user @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/settings/users')
  I.waitForText('Users', 15, 'h1')
  I.waitForText('member@example.com', 10)

  // Create: the invite is confirmed with a message; the row only appears
  // once the invitee accepts it, so no row is expected here.
  I.fillField('Email', 'qa.invitee@example.com')
  I.selectOption({ css: 'form select' }, 'Member')
  I.click('Send invite')
  I.waitForText('Invite sent.', 10)
  I.seeInField({ css: 'form input[type="email"]' }, '')

  // Alter: the seeded admin is switched to interviewer (PATCH /users/:id/role).
  const adminRole = { css: 'tr:has-text("admin@example.com") select' }
  I.selectOption(adminRole, 'Interviewer')
  // The row is refetched after the PATCH, so wait for the new value. The row
  // is found by its text because document.querySelector cannot parse the
  // Playwright-only :has-text extension used by the locator above.
  I.waitForFunction(() => {
    const row = Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr')).find(tr =>
      tr.innerText.includes('admin@example.com'),
    )
    const select = row && row.querySelector('select')
    return select instanceof HTMLSelectElement && select.value === 'interviewer'
  }, 10)
  I.seeInField(adminRole, 'interviewer')

  // Delete: window.confirm is accepted, then the row is gone.
  I.amAcceptingPopups()
  I.click('Remove', { css: 'tr:has-text("member@example.com")' })
  I.waitForInvisible({ css: 'tr:has-text("member@example.com")' }, 10)
  I.dontSee('member@example.com')

  // The last owner stays protected.
  I.see('The last owner cannot be removed or changed.')
})

Scenario('approvals requires a reason and then decides a request @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.amOnPage('/')
  I.waitForText('Approvals', 15, 'section[aria-label="Approvals"] h2')
  I.waitForText('3 waiting', 15, 'section[aria-label="Approvals"] span')

  const firstCard = { css: 'section[aria-label="Approvals"] li:first-child' }

  // Rejecting without a reason is blocked in the form, the API is not called.
  I.click('Reject', firstCard)
  I.click('Confirm reject')
  I.waitForText('A reason is required.', 10)
  I.fillField('Reason for rejecting (required)', 'Not a fit right now')
  I.dontSee('A reason is required.')
  I.click('Cancel')

  // Approving takes the request out of the inbox.
  I.click('Approve', firstCard)
  I.waitForText('2 waiting', 15, 'section[aria-label="Approvals"] span')
  I.dontSee('Annual leave, 20 to 24 Oct')
  I.see('Client dinner')
})

Scenario('tenant branding can be switched @ui', async ({ I }) => {
  await ensureSignedIn(I)

  // The shell applies Brand A as soon as it mounts.
  const logo = '#tenant-logo'
  I.waitForElement(logo, 15)
  // waitForFunction only forwards array arguments, so the selector must be
  // passed inside the args array.
  I.waitForFunction(
    ([selector]: [string]) => {
      const el = document.querySelector(selector) as HTMLImageElement | null
      return !!el && el.src.endsWith('text=A')
    },
    [logo],
    10,
  )

  I.click('Brand B')
  I.waitForFunction(
    ([selector]: [string]) => {
      const el = document.querySelector(selector) as HTMLImageElement | null
      return !!el && el.src.endsWith('text=B')
    },
    [logo],
    10,
  )

  I.click('Brand A')
  I.waitForFunction(
    ([selector]: [string]) => {
      const el = document.querySelector(selector) as HTMLImageElement | null
      return !!el && el.src.endsWith('text=A')
    },
    [logo],
    10,
  )
})

Scenario('dark mode toggle is available @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.see('Toggle light/dark')

  I.click('Toggle light/dark')
  I.waitForElement('html.dark', 10)

  I.click('Toggle light/dark')
  I.waitForElement('html:not(.dark)', 10)
})

Scenario('sign out returns to the sign-in screen @ui', async ({ I }) => {
  await ensureSignedIn(I)

  I.click('Sign out')
  I.waitForText('Sign in', 15, 'h1')

  // The session is gone: the next scenario must log in again if it runs.
  sessionEstablished = false
})
