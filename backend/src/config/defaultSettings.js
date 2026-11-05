// Default Business Settings (PRD §14.11). These seed the Settings record and
// fill in any value the owner has not set yet. Never hard-code these elsewhere.
export const defaultSettings = {
  store: {
    name: 'SHOPME',
    tagline: 'Style that speaks for you',
    logoUrl: '',
    faviconUrl: '',
    // Provided by the owner (PRD §24 #15). WhatsApp uses the same number as the
    // phone. Address and map location provided by the owner.
    email: 'shopmesupport2@gmail.com',
    phone: '+91 80891 11500',
    whatsappNumber: '918089111500',
    address: 'Apsara Arcade, MKK Nair Road, Palarivattom, Ernakulam, Kerala – 682025',
    businessHours: 'Open 24 hours',
    // Google Maps (owner's link and exact pin). "Get Directions" opens mapLink;
    // the interactive map shows mapQuery ("lat,lng"), falling back to the
    // address. No map is shown while both are blank.
    mapLink: 'https://www.google.com/maps/place/Apsara+Arcade,+MKK+Nair+Rd,+Palarivattom,+Ernakulam,+Keralam+682025/',
    mapQuery: '10.0017855,76.3048056',
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
