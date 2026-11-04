// Default Business Settings (PRD §14.11). These seed the Settings record and
// fill in any value the owner has not set yet. Never hard-code these elsewhere.
export const defaultSettings = {
  store: {
    name: 'SHOPME',
    tagline: 'Style that speaks for you',
    logoUrl: '',
    faviconUrl: '',
    // Provided by the owner (PRD §24 #15). WhatsApp uses the same number as the
    // phone; the address is blank (and hidden on the site) until provided.
    email: 'shopmesupport2@gmail.com',
    phone: '+91 80891 11500',
    whatsappNumber: '918089111500',
    address: '',
    businessHours: 'Open 24 hours',
  },
  delivery: {
    freeDeliveryThreshold: 500,
    deliveryCharge: 50,
    estimateMinDays: 4,
    estimateMaxDays: 7,
  },
  cod: {
    enabled: true,
    charge: 50,
    maxOrderValue: 5000,
  },
  orders: {
    maxQtyPerItem: 5,
    returnWindowDays: 7,
    newArrivalDays: 30,
    lowStockDefault: 5,
  },
  payments: {
    razorpayMode: 'test',
  },
  notifications: {
    adminAlertEmail: 'shopmesupport2@gmail.com',
    emailEnabled: true,
    whatsappEnabled: true,
  },
  // Not created yet; icons stay hidden on the site while a link is blank
  social: {
    instagram: '',
    facebook: '',
    youtube: '',
    x: '',
    pinterest: '',
  },
  seo: {
    title: 'SHOPME | Men, Women Fashion, Beauty & Accessories',
    description:
      'Shop the latest men’s and women’s clothing, fashion, beauty and accessories at SHOPME. Free delivery above ₹500, easy 7-day returns and Cash on Delivery across India.',
    shareImageUrl: '',
  },
};
