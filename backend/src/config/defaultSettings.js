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
    // Google Maps. "Get Directions" opens mapLink. The map shows mapEmbedUrl
    // (the owner's Google Maps "Embed a map" link); otherwise it looks up
    // mapQuery, then the address. Hidden while all are blank.
    mapLink: 'https://share.google/N0e6Ov2FS8KIklk2L',
    mapQuery: 'Apsara Arcade, MKK Nair Rd, Palarivattom, Ernakulam, Kerala 682025',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d125707.04733183153!2d76.2811485!3d10.0707727!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b080d10b3872af5%3A0x9c6cb479875726b0!2sApsara%20Arcade%2C%20MKK%20Nair%20Rd%2C%20Palarivattom%2C%20Ernakulam%2C%20Keralam%20682025!5e0!3m2!1sen!2sin!4v1793857498022!5m2!1sen!2sin',
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
