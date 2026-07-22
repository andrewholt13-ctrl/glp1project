export const dynamic = 'force-dynamic'










import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit'

const handler = NextAuth(authOptions)

type RouteContext = {
	params: {
		nextauth: string[]
	}
}

export async function POST(req: Request, context: RouteContext) {
	const ip = getClientIp(req)
	const limit = enforceRateLimit({
		key: `auth-login:${ip}`,
		limit: 10,
		windowMs: 15 * 60 * 1000,
	})

	if (!limit.allowed) {
		const retryAfter = Math.max(Math.ceil((limit.resetAt - Date.now()) / 1000), 1)
		return new Response(JSON.stringify({ error: 'Too many login attempts. Please try again later.' }), {
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(retryAfter),
			},
		})
	}

	return handler(req, context)
}

export { handler as GET }
