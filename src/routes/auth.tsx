import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { hashPassword, verifyPassword } from '../lib/password'
import { findUserByEmail, createUser } from '../lib/db-users'
import { createSession, destroySession, buildSessionCookieHeader, buildClearSessionCookieHeader, getCookieValue, SESSION_COOKIE } from '../lib/session'
import { SignupPage } from '../pages/signup'
import { LoginPage } from '../pages/login'

export const authRoutes = new Hono<AppEnv>()

authRoutes.get('/signup', async (c) => {
  return c.render(<SignupPage />, { title: 'Sign Up' })
})

authRoutes.post('/signup', async (c) => {
  const body = await c.req.parseBody()
  const name = ((body['name'] as string) || '').trim()
  const email = ((body['email'] as string) || '').trim().toLowerCase()
  const phone = ((body['phone'] as string) || '').trim()
  const password = (body['password'] as string) || ''
  const roleArtist = body['role_artist'] === '1'
  const roleEngineer = body['role_engineer'] === '1'

  if (!name || !email || !phone || !password) {
    return c.render(<SignupPage error="Please fill out all fields." />, { title: 'Sign Up' })
  }
  if (password.length < 8) {
    return c.render(<SignupPage error="Password must be at least 8 characters." />, { title: 'Sign Up' })
  }
  if (!roleArtist && !roleEngineer) {
    return c.render(<SignupPage error="Please select at least one: Artist or Engineer." />, { title: 'Sign Up' })
  }

  const existing = await findUserByEmail(c.env.DB, email)
  if (existing) {
    return c.render(<SignupPage error="An account with that email already exists. Try logging in instead." />, { title: 'Sign Up' })
  }

  const passwordHash = await hashPassword(password)
  const userId = await createUser(c.env.DB, {
    email,
    passwordHash,
    name,
    phone,
    isEngineer: roleEngineer,
    isArtist: roleArtist
  })

  const token = await createSession(c.env.DB, userId)
  c.header('Set-Cookie', buildSessionCookieHeader(token))

  if (roleEngineer) {
    return c.redirect('/dashboard/profile')
  }
  return c.redirect('/dashboard')
})

authRoutes.get('/login', async (c) => {
  return c.render(<LoginPage />, { title: 'Log In' })
})

authRoutes.post('/login', async (c) => {
  const body = await c.req.parseBody()
  const email = ((body['email'] as string) || '').trim().toLowerCase()
  const password = (body['password'] as string) || ''

  if (!email || !password) {
    return c.render(<LoginPage error="Please enter your email and password." />, { title: 'Log In' })
  }

  const user = await findUserByEmail(c.env.DB, email)
  if (!user) {
    return c.render(<LoginPage error="Incorrect email or password." />, { title: 'Log In' })
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return c.render(<LoginPage error="Incorrect email or password." />, { title: 'Log In' })
  }

  const token = await createSession(c.env.DB, user.id)
  c.header('Set-Cookie', buildSessionCookieHeader(token))
  return c.redirect('/dashboard')
})

authRoutes.post('/logout', async (c) => {
  const token = getCookieValue(c.req.raw, SESSION_COOKIE)
  if (token) {
    await destroySession(c.env.DB, token)
  }
  c.header('Set-Cookie', buildClearSessionCookieHeader())
  return c.redirect('/')
})
