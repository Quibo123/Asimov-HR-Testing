const http = require('http')

// ---- Fake data ----
let role = 'owner'      // the signed-in user's role (switch with /__role/<role>)
let force401 = false    // makes every call return 401 (switch with /__401/on|off)
let failApply = false   // drops the application request to imitate a network failure (/__fail/on|off)

const ME_EMAIL = 'zeu94424@gmail.com' // must match your Supabase user
const day = 24 * 60 * 60 * 1000

let users = [
  { id: 'u1', email: ME_EMAIL, role: 'owner' },
  { id: 'u2', email: 'admin@example.com', role: 'admin' },
  { id: 'u3', email: 'member@example.com', role: 'member' },
]

const invites = {
  'valid-token':   { email: ME_EMAIL, role: 'member', expiresAt: new Date(Date.now() + 6 * day).toISOString() },
  'expired-token': { email: ME_EMAIL, role: 'member', expiresAt: new Date(Date.now() - 1 * day).toISOString() },
}

const jobs = [
  {
    id: 'j1', title: 'Frontend Engineer', location: 'Chennai', type: 'Full-time', status: 'open',
    description: 'Build the screens our customers use every day.\nYou will work in React and TypeScript.',
    questions: [
      { id: 'q1', type: 'text', label: 'Why do you want this role?', required: true, maxLength: 300 },
      { id: 'q2', type: 'choice', label: 'Preferred work mode', required: true, options: ['Office', 'Hybrid', 'Remote'] },
      { id: 'q3', type: 'yesno', label: 'Can you start within 30 days?', required: true },
      { id: 'q4', type: 'number', label: 'Years of React experience', required: true, min: 0, max: 40 },
      { id: 'q5', type: 'rating', label: 'Rate your TypeScript skills', required: true, max: 5 },
    ],
  },
  {
    id: 'j2', title: 'Product Designer', location: 'Remote', type: 'Contract', status: 'closed',
    description: 'Closed role.', questions: [],
  },
]

// ---- Talently templates (AS-125) ----
let templates = [
  {
    id: 't1', name: 'Frontend screening', version: 1, liveJobs: 1,
    questions: [
      { id: 'a1', type: 'choice', label: 'Years of experience', required: true, weight: 40,
        options: [
          { id: 'o1', label: '5+ years', scorePercent: 100 },
          { id: 'o2', label: '3-4 years', scorePercent: 70 },
          { id: 'o3', label: '1-2 years', scorePercent: 30 },
          { id: 'o4', label: 'Less than 1 year', scorePercent: 0 },
        ],
        mustHave: true, rule: { op: 'gte', value: 70 } },
      { id: 'a2', type: 'yesno', label: 'Can you start within 30 days?', required: true, weight: 20,
        options: [{ id: 'yes', label: 'Yes', scorePercent: 100 }, { id: 'no', label: 'No', scorePercent: 0 }],
        mustHave: false },
      { id: 'a3', type: 'rating', label: 'Rate your TypeScript skills', required: true, weight: 25,
        options: [], mustHave: false },
      { id: 'a4', type: 'text', label: 'Why do you want this role?', required: true, weight: 15,
        options: [], mustHave: false },
    ],
  },
  { id: 't2', name: 'General screening', version: 1, liveJobs: 0, questions: [] },
]
const templateSummary = t => ({
  id: t.id, name: t.name, version: t.version, questionCount: t.questions.length, liveJobs: t.liveJobs,
})
const weightSum = qs => qs.reduce((s, q) => s + (Number(q.weight) || 0), 0)

// ---- Candidates (AS-116) ----
const item = (questionId, label, answer, weight, points, mustHave = false, mustHaveMet = true) =>
  ({ questionId, label, answer, weight, points, originalPoints: points, mustHave, mustHaveMet })

const mkCandidate = (id, name, daysAgo, breakdown, extra = {}) => ({
  id, name, jobId: 'j1', jobTitle: 'Frontend Engineer', status: 'new',
  appliedAt: new Date(Date.now() - daysAgo * day).toISOString(),
  verifiedBy: null, verifiedAt: null,
  resumeUrl: 'http://localhost:3000/files/resume.pdf',
  breakdown, ...extra,
})

let candidates = [
  mkCandidate('c1', 'Asha Rao', 1, [
    item('a1', 'Years of experience', '5+ years', 40, 40, true, true),
    item('a2', 'Can you start within 30 days?', 'Yes', 20, 20),
    item('a3', 'Rate your TypeScript skills', '4', 25, 20),
    item('a4', 'Why do you want this role?', 'I enjoy building product interfaces.', 15, 10),
  ]),
  mkCandidate('c2', 'Ben Thomas', 2, [
    item('a1', 'Years of experience', '3-4 years', 40, 28, true, true),
    item('a2', 'Can you start within 30 days?', 'No', 20, 0),
    item('a3', 'Rate your TypeScript skills', '3', 25, 15),
    item('a4', 'Why do you want this role?', 'Looking for a new challenge.', 15, 9),
  ]),
  mkCandidate('c3', 'Chitra Devi', 3, [
    item('a1', 'Years of experience', 'Less than 1 year', 40, 0, true, false),
    item('a2', 'Can you start within 30 days?', 'Yes', 20, 20),
    item('a3', 'Rate your TypeScript skills', '5', 25, 25),
    item('a4', 'Why do you want this role?', 'I learn fast and ship often.', 15, 12),
  ]),
  mkCandidate('c4', 'Dev Patel', 5, [
    item('a1', 'Years of experience', '1-2 years', 40, 12, true, false),
    item('a2', 'Can you start within 30 days?', 'Yes', 20, 20),
    item('a3', 'Rate your TypeScript skills', '4', 25, 20),
    item('a4', 'Why do you want this role?', 'Design systems excite me.', 15, 11),
  ], {
    jobId: 'j2', jobTitle: 'Product Designer', status: 'verified',
    verifiedBy: 'hr@example.com', verifiedAt: new Date(Date.now() - 1 * day).toISOString(),
  }),
]

const r1 = n => Math.round(n * 10) / 10
const totalOf = c => r1(c.breakdown.reduce((s, b) => s + b.points, 0))
const candSummary = c => ({
  id: c.id, name: c.name, jobId: c.jobId, jobTitle: c.jobTitle, score: totalOf(c),
  mustHaveFailed: c.breakdown.some(b => b.mustHave && !b.mustHaveMet),
  status: c.status, appliedAt: c.appliedAt,
})
const candDetail = c => ({
  ...candSummary(c), resumeUrl: c.resumeUrl, verifiedBy: c.verifiedBy, verifiedAt: c.verifiedAt,
  breakdown: c.breakdown,
})

// A tiny valid PDF so the resume panel has something to show
function makePdf(text) {
  const stream = `BT /F1 24 Tf 60 760 Td (${text}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach(o => { out += String(o).padStart(10, '0') + ' 00000 n \n' })
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return out
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...cors })
  res.end(data === undefined ? '' : JSON.stringify(data))
}

// Multipart bodies (the apply form) must not be parsed as JSON
function readBody(req) {
  return new Promise(resolve => {
    let raw = ''
    req.on('data', c => (raw += c))
    req.on('end', () => {
      const isJson = (req.headers['content-type'] || '').includes('json')
      try { resolve(raw && isJson ? JSON.parse(raw) : {}) } catch { resolve({}) }
    })
  })
}

const canManage = () => role === 'owner' || role === 'admin'
const ownerCount = () => users.filter(u => u.role === 'owner').length

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors)
      return res.end()
    }

    const path = new URL(req.url, 'http://localhost').pathname
    const parts = path.split('/').filter(Boolean)
    const body = await readBody(req)
    console.log(req.method, path, `(role: ${role})`)

    // ---- Control endpoints (open them in the browser) ----
    if (parts[0] === '__role') { role = parts[1]; return send(res, 200, { role }) }
    if (parts[0] === '__401') { force401 = parts[1] === 'on'; return send(res, 200, { force401 }) }
    if (parts[0] === '__fail') { failApply = parts[1] === 'on'; return send(res, 200, { failApply }) }

    // ---- Sample resume (the iframe cannot send a token, so a real API would use a signed link) ----
    if (req.method === 'GET' && path === '/files/resume.pdf') {
      res.writeHead(200, { 'Content-Type': 'application/pdf', ...cors })
      return res.end(makePdf('Sample resume'))
    }

    // ---- Careers (public, no token) ----
    if (req.method === 'GET' && path === '/public/jobs') {
      return send(res, 200, jobs.map(j => ({ id: j.id, title: j.title, location: j.location, type: j.type, status: j.status })))
    }
    if (req.method === 'GET' && parts[0] === 'public' && parts[1] === 'jobs' && parts[2] && !parts[3]) {
      const j = jobs.find(x => x.id === parts[2])
      return j ? send(res, 200, j) : send(res, 404, { error: 'not found' })
    }
    if (req.method === 'POST' && parts[0] === 'public' && parts[1] === 'jobs' && parts[3] === 'applications') {
      if (failApply) { req.socket.destroy(); return }
      const j = jobs.find(x => x.id === parts[2])
      if (!j) return send(res, 404, { error: 'not found' })
      if (j.status === 'closed') return send(res, 409, { error: 'closed' })
      console.log('  Application received for', j.title)
      return send(res, 201, { ok: true })
    }

    // ---- Public invite endpoints (no token needed) ----
    if (req.method === 'GET' && parts[0] === 'invites' && parts[1]) {
      const inv = invites[parts[1]]
      return inv ? send(res, 200, inv) : send(res, 404, { error: 'not found' })
    }
    if (req.method === 'POST' && path === '/invites/accept') {
      const inv = invites[body.token]
      if (!inv) return send(res, 404, { error: 'not found' })
      if (new Date(inv.expiresAt).getTime() < Date.now()) return send(res, 410, { error: 'expired' })
      return send(res, 204)
    }

    // ---- Everything below needs a token ----
    if (force401 || !req.headers.authorization) return send(res, 401, { error: 'unauthorized' })

    if (req.method === 'GET' && path === '/me') {
      return send(res, 200, { id: 'u1', email: ME_EMAIL, role })
    }

    // Members are refused here, so you can prove "the API still refuses"
    if (!canManage()) return send(res, 403, { error: 'forbidden' })

    // ---- Talently templates (token + manager role) ----
    if (parts[0] === 'talently' && parts[1] === 'templates') {
      const id = parts[2]
      const t = id ? templates.find(x => x.id === id) : null

      if (req.method === 'GET' && !id) return send(res, 200, templates.map(templateSummary))
      if (req.method === 'GET' && id && !parts[3]) return t ? send(res, 200, t) : send(res, 404, { error: 'not found' })

      if (req.method === 'POST' && !id) {
        if (weightSum(body.questions || []) !== 100) return send(res, 422, { error: 'weights must total 100' })
        const created = { id: 't' + Date.now(), name: body.name, version: 1, liveJobs: 0, questions: body.questions }
        templates.push(created)
        return send(res, 201, { id: created.id })
      }

      if (req.method === 'PUT' && id && !parts[3]) {
        if (!t) return send(res, 404, { error: 'not found' })
        if (weightSum(body.questions || []) !== 100) return send(res, 422, { error: 'weights must total 100' })
        if (t.liveJobs > 0) t.version += 1 // live jobs keep the old version, so this is a new one
        t.name = body.name
        t.questions = body.questions
        console.log(`  Template "${t.name}" saved as version ${t.version}`)
        return send(res, 200, { id: t.id, version: t.version })
      }

      if (req.method === 'POST' && id && parts[3] === 'copy') {
        if (!t) return send(res, 404, { error: 'not found' })
        const copy = { ...structuredClone(t), id: 't' + Date.now(), name: 'Copy of ' + t.name, version: 1, liveJobs: 0 }
        templates.push(copy)
        return send(res, 201, { id: copy.id })
      }
    }

    // ---- Talently candidates (AS-116) ----
    if (parts[0] === 'talently' && parts[1] === 'candidates') {
      const id = parts[2]
      const c = id ? candidates.find(x => x.id === id) : null

      if (req.method === 'GET' && !id) return send(res, 200, candidates.map(candSummary))
      if (id && !c) return send(res, 404, { error: 'not found' })
      if (req.method === 'GET' && id && !parts[3]) return send(res, 200, candDetail(c))

      if (req.method === 'POST' && parts[3] === 'verify') {
        if (!c.verifiedAt) {
          c.verifiedBy = ME_EMAIL
          c.verifiedAt = new Date().toISOString()
          if (c.status === 'new') c.status = 'verified'
          console.log(`  ${c.name} verified by ${ME_EMAIL}`)
        }
        return send(res, 200, candDetail(c))
      }

      if (req.method === 'POST' && parts[3] === 'adjust') {
        const b = c.breakdown.find(x => x.questionId === body.questionId)
        if (!b) return send(res, 404, { error: 'question not found' })
        if (!String(body.reason || '').trim()) return send(res, 422, { error: 'reason required' })
        const pts = Number(body.points)
        if (Number.isNaN(pts) || pts < 0 || pts > b.weight) return send(res, 422, { error: 'points out of range' })
        b.points = pts // originalPoints is never touched, so the original is kept
        b.adjustment = { by: ME_EMAIL, at: new Date().toISOString(), reason: String(body.reason).trim() }
        console.log(`  ${c.name}: "${b.label}" adjusted ${b.originalPoints} -> ${pts}`)
        return send(res, 200, candDetail(c))
      }

      if (req.method === 'POST' && parts[3] === 'shortlist') {
        if (!c.verifiedAt) return send(res, 409, { error: 'verify the score first' })
        c.status = 'shortlisted'
        return send(res, 200, candDetail(c))
      }
    }

    if (req.method === 'GET' && path === '/users') return send(res, 200, users)

    if (req.method === 'POST' && path === '/invites') {
      const token = Math.random().toString(36).slice(2)
      invites[token] = { email: body.email, role: body.role, expiresAt: new Date(Date.now() + 7 * day).toISOString() }
      console.log(`  Invite link: http://localhost:5173/accept/${token}`)
      return send(res, 201, { token })
    }

    if (req.method === 'PATCH' && parts[0] === 'users' && parts[2] === 'role') {
      const u = users.find(x => x.id === parts[1])
      if (!u) return send(res, 404, { error: 'not found' })
      if (u.role === 'owner' && body.role !== 'owner' && ownerCount() === 1)
        return send(res, 409, { error: 'cannot change the last owner' })
      u.role = body.role
      return send(res, 200, u)
    }

    if (req.method === 'DELETE' && parts[0] === 'users' && parts[1]) {
      const u = users.find(x => x.id === parts[1])
      if (!u) return send(res, 404, { error: 'not found' })
      if (u.role === 'owner' && ownerCount() === 1)
        return send(res, 409, { error: 'cannot remove the last owner' })
      users = users.filter(x => x.id !== parts[1])
      return send(res, 204)
    }

    send(res, 404, { error: 'unknown route' })
  })
  .listen(3000, () => console.log('Mock API on http://localhost:3000'))