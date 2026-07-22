import Link from 'next/link'

export default function PaymentSuccess() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="card max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Received!</h1>
        <p className="text-gray-500 mb-6">
          Your payment is complete. Your order is now marked paid and ready for pharmacy fulfillment.
        </p>
        <Link href="/login" className="btn-primary inline-block">
          Track Your Order →
        </Link>
      </div>
    </div>
  )
}
