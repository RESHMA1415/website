// Loads Razorpay's payment window script once (card/UPI details stay with Razorpay)
let loading;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => {
        loading = null;
        reject(new Error('We couldn’t open the payment window. Please check your internet connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return loading;
}

// Opens the payment window. Resolves with { paid: response } or { closed, reason }.
export async function openRazorpay(options, brandColour = '#FF7A00') {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    let failure = '';
    const rzp = new Razorpay({
      key: options.key,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.orderId,
      prefill: options.prefill,
      notes: options.notes,
      theme: { color: brandColour },
      handler: (response) => resolve({ paid: response }),
      modal: {
        confirm_close: true,
        ondismiss: () => resolve({ closed: true, reason: failure || 'Payment window closed' }),
      },
    });
    // Razorpay keeps its window open after a failed try so the customer can try again
    rzp.on('payment.failed', (response) => {
      failure = response?.error?.description || 'Payment failed';
    });
    rzp.open();
  });
}
