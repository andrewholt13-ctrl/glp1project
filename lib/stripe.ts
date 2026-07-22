import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
})

export async function createCheckoutSession({
  patientEmail,
  patientName,
  orderId,
  metadata,
  lineItems,
  successUrl,
  cancelUrl,
}: {
  patientEmail: string
  patientName: string
  orderId: string
  metadata?: Record<string, string>
  lineItems: Array<{ name: string; description: string; amount: number; quantity: number }>
  successUrl: string
  cancelUrl: string
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: patientEmail,
    line_items: lineItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: Math.round(item.amount * 100),
      },
      quantity: item.quantity,
    })),
    metadata: { orderId, ...(metadata ?? {}) },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return session
}
