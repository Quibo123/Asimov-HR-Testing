#!/usr/bin/env node
/**
 * Local GoTrue stand-in for the Asimov HR UI tests.
 *
 * The new frontend (@supabase/supabase-js) refuses to boot without
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, and its shell sits behind
 * sign-in. This server implements the four auth endpoints the app calls so
 * the suite can drive the real /signin form offline.
 *
 * It accepts ANY non-empty email/password pair: it is a local test double,
 * never a credential store. Run it on localhost only.
 *
 *   node scripts/fake-supabase.cjs            # http://127.0.0.1:54321
 *   PORT=55555 node scripts/fake-supabase.cjs
 */
const http = require('node:http')
const crypto = require('node:crypto')

const PORT = Number(process.env.PORT) || 54321
const USER_ID = '00000000-0000-4000-8000-000000000001'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const now = () => Math.round(Date.now() / 1000)
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

function buildUser(email) {
  const stamp = new Date().toISOString()
  return {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: stamp,
    created_at: stamp,
    updated_at: stamp,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    is_anonymous: false,
  }
}

function buildSession(email) {
  const iat = now()
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const payload = b64({ sub: USER_ID, email, role: 'authenticated', iat, exp: iat + 86400 })
  return {
    access_token: `${header}.${payload}.local-signature`,
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: iat + 86400,
    refresh_token: `refresh_${crypto.randomUUID()}`,
    user: buildUser(email),
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function reply(res, status, payload) {
  const body = payload === undefined ? '' : JSON.stringify(payload)
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const path = url.pathname
  const grant = url.searchParams.get('grant_type')

  if (req.method === 'OPTIONS') return reply(res, 204)

  if (req.method === 'POST' && path === '/auth/v1/token') {
    const body = await readBody(req)

    if (grant === 'refresh_token') {
      if (!body.refresh_token) {
        return reply(res, 400, { error: 'invalid_grant', error_description: 'refresh_token is required' })
      }
      return reply(res, 200, buildSession('qa@asimov.local'))
    }

    if (grant === 'password') {
      if (!body.email || !body.password) {
        return reply(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      }
      // Logged so a run can prove it signed in exactly once.
      console.log(`password sign-in: ${body.email}`)
      return reply(res, 200, buildSession(String(body.email)))
    }

    return reply(res, 400, { error: 'unsupported_grant_type', error_description: String(grant) })
  }

  if (req.method === 'GET' && path === '/auth/v1/user') {
    if (!req.headers.authorization) return reply(res, 401, { error: 'missing_authorization' })
    return reply(res, 200, buildUser('qa@asimov.local'))
  }

  if (req.method === 'POST' && path === '/auth/v1/logout') return reply(res, 204)

  return reply(res, 404, { error: 'not_found', path })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fake Supabase auth on http://127.0.0.1:${PORT}`)
})
