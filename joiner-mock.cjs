// Joiner portal (public) and HR progress board (AS-215). Called from mock-api.cjs.
const today = () => new Date().toISOString().slice(0, 10)
const plus = (base, n) => {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

let dropUploads = false // /__joinfail/on makes every joiner POST fail like a dropped network
let seq = 0

// title, who owns it, what it needs, due day (days from the joining date), done?, help text
const T = (title, ownerRole, requirement, dueOffset, done = false, description = '') =>
  ({ title, ownerRole, requirement, dueOffset, done, description })

function make(id, token, name, department, location, joinOffset, templateName, defs) {
  const joiningDate = plus(today(), joinOffset)
  return {
    id, token, name, department, location, joiningDate, templateName,
    tasks: defs.map(d => ({
      id: 'jt' + ++seq, title: d.title, ownerRole: d.ownerRole, requirement: d.requirement,
      description: d.description, dueDate: plus(joiningDate, d.dueOffset), status: d.done ? 'done' : 'todo',
    })),
  }
}

const joiners = [
  // Joins in 5 days. Five steps for the joiner: 2 documents and 3 acknowledgements.
  make('n1', 'nila-ravi', 'Nila Ravi', 'Production', 'Tiruppur', 5, 'Operator — Tiruppur', [
    T('Collect the signed offer acceptance', 'hr', 'document', -7, true),
    T('Upload your ID proof', 'employee', 'document', -5, false,
      'Take a clear photo of your Aadhaar card or passport.\nMake sure all four corners can be seen.'),
    T('Upload your bank passbook', 'employee', 'document', -5, false,
      'Take a photo of the first page of your passbook, with your name and account number.'),
    T('Set up laptop and email', 'it', 'acknowledgement', -2),
    T('Read the code of conduct', 'employee', 'acknowledgement', 1, false,
      'Please read it carefully. It explains how we work together.'),
    T('Read the safety rules', 'employee', 'acknowledgement', -1, false,
      'These rules keep you and your team safe on the shop floor.'),
    T('Confirm your emergency contact', 'employee', 'acknowledgement', -1, false,
      'The emergency contact we have on file is correct.'),
  ]),
  // Joins in 2 days. HR is late, and IT is due today.
  make('n2', 'omar-sheikh', 'Omar Sheikh', 'Design', 'Chennai', 2, 'Standard onboarding', [
    T('Collect the signed offer acceptance', 'hr', 'document', -7),
    T('Set up laptop and email', 'it', 'acknowledgement', -2),
    T('Read the code of conduct', 'employee', 'acknowledgement', 1, false, 'Please read it carefully.'),
    T('Welcome meeting', 'manager', 'acknowledgement', 0),
  ]),
  // Joins in 10 days. Nothing is due yet, so no blockers.
  make('n3', 'quinn-ali', 'Quinn Ali', 'Sales', 'Chennai', 10, 'Standard onboarding', [
    T('Collect the signed offer acceptance', 'hr', 'document', -7),
    T('Upload your ID proof', 'employee', 'document', -5, false, 'Take a clear photo of your ID.'),
    T('Welcome meeting', 'manager', 'acknowledgement', 0),
  ]),
  // Joined yesterday. Everything is done except the manager's welcome meeting.
  make('n4', 'riya-sen', 'Riya Sen', 'Engineering', 'Chennai', -1, 'Standard onboarding', [
    T('Collect the signed offer acceptance', 'hr', 'document', -7, true),
    T('Upload your ID proof', 'employee', 'document', -5, true),
    T('Set up laptop and email', 'it', 'acknowledgement', -2, true),
    T('Welcome meeting', 'manager', 'acknowledgement', 0),
  ]),
  // Everything is done.
  make('n5', 'sam-joseph', 'Sam Joseph', 'Finance', 'Bengaluru', 3, 'Standard onboarding', [
    T('Collect the signed offer acceptance', 'hr', 'document', -7, true),
    T('Read the code of conduct', 'employee', 'acknowledgement', 1, true),
    T('Welcome meeting', 'manager', 'acknowledgement', 0, true),
  ]),
]

// The joiner only sees their own tasks
const viewOf = j => ({
  name: j.name,
  joiningDate: j.joiningDate,
  tasks: j.tasks
    .filter(t => t.ownerRole === 'employee')
    .map(({ id, title, description, requirement, status, dueDate }) => ({ id, title, description, requirement, status, dueDate })),
})

const boardOf = j => ({
  id: j.id, name: j.name, department: j.department, location: j.location,
  joiningDate: j.joiningDate, templateName: j.templateName,
  tasks: j.tasks.map(({ id, title, ownerRole, dueDate, status }) => ({ id, title, ownerRole, dueDate, status })),
})

// Returns true when it handled the request
module.exports = function joinerMock({ req, res, parts, path, body, hasToken, canManage, empty, send, log }) {
  if (parts[0] === '__joinfail') {
    dropUploads = parts[1] === 'on'
    send(res, 200, { dropUploads })
    return true
  }

  // ---- HR progress board: token and HR only ----
  if (path === '/onboard/board') {
    if (req.method !== 'GET') return false
    if (!hasToken) { send(res, 401, { error: 'unauthorized' }); return true }
    if (!canManage) { send(res, 403, { error: 'forbidden' }); return true }
    send(res, 200, { asOf: today(), joiners: empty ? [] : joiners.map(boardOf) })
    return true
  }

  // ---- Joiner portal: public, the link is the permission ----
  if (parts[0] !== 'joiner') return false
  const token = parts[1]
  if (token === 'expired-link') { send(res, 410, { error: 'link expired' }); return true }
  const j = joiners.find(x => x.token === token)
  if (!j) { send(res, 404, { error: 'not found' }); return true }

  if (req.method === 'GET' && !parts[2]) { send(res, 200, viewOf(j)); return true }

  if (req.method === 'POST' && parts[2] === 'tasks' && parts[3] && (parts[4] === 'acknowledge' || parts[4] === 'document')) {
    if (dropUploads) { req.socket.destroy(); return true } // the phone sees a dropped network
    const task = j.tasks.find(t => t.id === parts[3] && t.ownerRole === 'employee')
    if (!task) { send(res, 404, { error: 'task not found' }); return true }

    if (parts[4] === 'acknowledge') {
      if (task.requirement !== 'acknowledgement') { send(res, 409, { error: 'this task needs a document' }); return true }
    } else {
      if (task.requirement !== 'document') { send(res, 409, { error: 'this task needs an acknowledgement' }); return true }
      const m = /filename="([^"]+)"/.exec(body.__raw || '')
      if (!m) { send(res, 422, { error: 'file required' }); return true }
      const ext = m[1].split('.').pop().toLowerCase()
      if (!['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) { send(res, 422, { error: 'file type not allowed' }); return true }
      const size = Number(req.headers['content-length']) || 0
      if (size > 10 * 1024 * 1024) { send(res, 413, { error: 'file too large' }); return true }
      log(`  ${j.name} sent "${m[1]}" (${Math.round(size / 1024)} KB) for "${task.title}"`)
    }

    task.status = 'done'
    if (parts[4] === 'acknowledge') log(`  ${j.name} acknowledged "${task.title}"`)
    send(res, 200, viewOf(j))
    return true
  }

  return false
}