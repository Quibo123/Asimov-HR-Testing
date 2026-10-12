// Onboarding templates (AS-212). Called from mock-api.cjs for every /onboard request.
const DEPARTMENTS = ['Production', 'Engineering', 'HR', 'Finance', 'Sales']
const LOCATIONS = ['Tiruppur', 'Chennai', 'Bengaluru', 'Mumbai']
const ROLES = ['hr', 'manager', 'it', 'finance', 'employee']
const REQUIREMENTS = ['document', 'acknowledgement']

let seq = 100
const task = (title, ownerRole, dueOffset, requirement) =>
  ({ id: 'k' + ++seq, title, ownerRole, dueOffset, requirement })

let templates = [
  {
    id: 't1', name: 'Standard onboarding', isDefault: true, departments: [], locations: [], runningCount: 4,
    tasks: [
      task('Collect signed offer acceptance', 'hr', -7, 'document'),
      task('Set up laptop and email', 'it', -2, 'acknowledgement'),
      task('Welcome meeting', 'manager', 0, 'acknowledgement'),
    ],
  },
  {
    id: 't2', name: 'Office staff — Chennai', isDefault: false,
    departments: ['Engineering', 'Finance'], locations: ['Chennai'], runningCount: 0,
    tasks: [
      task('Upload ID proof', 'employee', -5, 'document'),
      task('Issue access card', 'hr', 0, 'document'),
    ],
  },
]

const summary = t => ({
  id: t.id, name: t.name, isDefault: t.isDefault, taskCount: t.tasks.length,
  departments: t.departments, locations: t.locations, runningCount: t.runningCount,
})

function check(b) {
  const problems = []
  if (!String(b.name || '').trim()) problems.push('name required')
  if (!Array.isArray(b.tasks) || b.tasks.length === 0) problems.push('at least one task required')
  ;(b.tasks || []).forEach((k, i) => {
    const n = i + 1
    if (!String(k.title || '').trim()) problems.push(`task ${n}: title required`)
    if (!ROLES.includes(k.ownerRole)) problems.push(`task ${n}: unknown owner role`)
    if (!REQUIREMENTS.includes(k.requirement)) problems.push(`task ${n}: requirement must be document or acknowledgement`)
    if (!Number.isInteger(k.dueOffset) || k.dueOffset < -90 || k.dueOffset > 90) problems.push(`task ${n}: due offset must be a whole number from -90 to 90`)
  })
  const depts = Array.isArray(b.departments) ? b.departments : []
  const locs = Array.isArray(b.locations) ? b.locations : []
  if (depts.some(d => !DEPARTMENTS.includes(d))) problems.push('unknown department')
  if (locs.some(l => !LOCATIONS.includes(l))) problems.push('unknown location')
  if (!b.isDefault && depts.length === 0 && locs.length === 0) problems.push('a match rule is required unless this is the default template')
  return problems
}

const clean = b => ({
  name: String(b.name).trim(),
  departments: b.departments || [],
  locations: b.locations || [],
  tasks: b.tasks.map(k => ({
    id: k.id || 'k' + ++seq, title: String(k.title).trim(), ownerRole: k.ownerRole,
    dueOffset: k.dueOffset, requirement: k.requirement,
  })),
})

// Returns true when it handled the request
module.exports = function onboard({ req, res, parts, body, canManage, send, log }) {
  if (!canManage) { send(res, 403, { error: 'forbidden' }); return true }

  if (req.method === 'GET' && parts[1] === 'options' && !parts[2]) {
    send(res, 200, { departments: DEPARTMENTS, locations: LOCATIONS })
    return true
  }
  if (parts[1] !== 'templates') return false

  const id = parts[2]
  const t = id ? templates.find(x => x.id === id) : null

  if (req.method === 'GET' && !id) { send(res, 200, templates.map(summary)); return true }
  if (id && !t) { send(res, 404, { error: 'not found' }); return true }
  if (req.method === 'GET' && id) { send(res, 200, t); return true }

  if (req.method === 'POST' && !id) {
    const problems = check(body)
    if (problems.length) { send(res, 422, { error: 'invalid template', problems }); return true }
    const hasDefault = templates.some(x => x.isDefault)
    const isDefault = Boolean(body.isDefault) || !hasDefault // the first template becomes the default
    if (isDefault) templates.forEach(x => { x.isDefault = false })
    const created = { id: 't' + Date.now(), isDefault, runningCount: 0, ...clean(body) }
    templates.push(created)
    log(`  Template "${created.name}" created${isDefault ? ' (now the default)' : ''}`)
    send(res, 201, { id: created.id })
    return true
  }

  if (req.method === 'PUT' && id) {
    const problems = check(body)
    if (problems.length) { send(res, 422, { error: 'invalid template', problems }); return true }
    if (t.isDefault && !body.isDefault) {
      send(res, 409, { error: 'there must always be one default template. Make another template the default instead.' })
      return true
    }
    if (body.isDefault) templates.forEach(x => { x.isDefault = false })
    Object.assign(t, clean(body), { isDefault: Boolean(body.isDefault) })
    // Running onboardings keep the tasks they were created with
    log(`  Template "${t.name}" saved. ${t.runningCount} running onboardings were not changed`)
    send(res, 200, { id: t.id })
    return true
  }

  return false
} 