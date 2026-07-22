import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

type Role = 'MASTER_ADMIN' | 'ADMIN' | 'PROVIDER' | 'PATIENT' | 'INFLUENCER' | 'PHARMACY'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      mustResetPassword: boolean
    }
  }
  interface User {
    id: string
    email: string
    name: string
    role: Role
    mustResetPassword: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role
    id: string
    mustResetPassword: boolean
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        if (user.mustResetPassword) {
          throw new Error('PasswordResetRequired')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          mustResetPassword: Boolean(user.mustResetPassword),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.mustResetPassword = Boolean(user.mustResetPassword)
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.mustResetPassword = Boolean(token.mustResetPassword)
      return session
    },
  },
}

export function getRoleDashboard(role: Role): string {
  switch (role) {
    case 'MASTER_ADMIN': return '/admin'
    case 'ADMIN':        return '/admin'
    case 'PROVIDER':     return '/provider'
    case 'PHARMACY':     return '/pharmacy'
    case 'INFLUENCER':   return '/influencer'
    case 'PATIENT':      return '/medication-selection'
    default:             return '/login'
  }
}
