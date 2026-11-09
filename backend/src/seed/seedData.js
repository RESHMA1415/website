// Starter data for a fresh database. Sample products are placeholders the
// owner replaces with real stock in Phase 2.

import { INFO_PAGES, LEGAL_PAGES } from '../content/legal/index.js';

export const categoryTree = [
  {
    name: 'Men',
    slug: 'men',
    gender: 'men',
    productType: 'clothing',
    description: 'Everyday essentials and statement pieces for men.',
    children: [
      { name: 'T-Shirts', slug: 'men-t-shirts' },
      { name: 'Shirts', slug: 'men-shirts' },
      { name: 'Jeans & Trousers', slug: 'men-jeans-trousers' },
      { name: 'Ethnic Wear', slug: 'men-ethnic-wear' },
      { name: 'Winter Wear', slug: 'men-winter-wear' },
    ],
  },
  {
    name: 'Women',
    slug: 'women',
    gender: 'women',
    description: 'Clothing, fashion, beauty and accessories for women.',
    children: [
      {
        name: 'Clothing',
        slug: 'women-clothing',
        productType: 'clothing',
        children: [
          { name: 'Tops & T-Shirts', slug: 'women-tops-t-shirts' },
          { name: 'Dresses', slug: 'women-dresses' },
          { name: 'Kurtis & Ethnic Wear', slug: 'women-kurtis-ethnic-wear' },
          { name: 'Jeans & Trousers', slug: 'women-jeans-trousers' },
          { name: 'Sarees', slug: 'women-sarees' },
        ],
      },
      {
        name: 'Fashion',
        slug: 'women-fashion',
        productType: 'fashion',
        children: [
          { name: 'Bags', slug: 'women-bags' },
          { name: 'Footwear', slug: 'women-footwear' },
          { name: 'Scarves & Stoles', slug: 'women-scarves' },
          { name: 'Sunglasses', slug: 'women-sunglasses' },
        ],
      },
      {
        name: 'Beauty',
        slug: 'women-beauty',
        productType: 'beauty',
        children: [
          { name: 'Makeup', slug: 'women-makeup' },
          { name: 'Skincare', slug: 'women-skincare' },
          { name: 'Fragrance', slug: 'women-fragrance' },
        ],
      },
      {
        name: 'Accessories',
        slug: 'women-accessories',
        productType: 'accessories',
        children: [
          { name: 'Jewellery', slug: 'women-jewellery' },
          { name: 'Watches', slug: 'women-watches' },
          { name: 'Hair Accessories', slug: 'women-hair-accessories' },
        ],
      },
    ],
  },
];

export const banners = [
  {
    heading: 'New Season. New You.',
    subHeading: 'Fresh styles for men and women, delivered across India.',
    buttonText: 'Shop New Arrivals',
    buttonLink: '/new-arrivals',
    displayOrder: 1,
  },
  {
    heading: 'Women’s Fashion & Beauty',
    subHeading: 'Bags, footwear, makeup and accessories to complete your look.',
    buttonText: 'Explore Women',
    buttonLink: '/women',
    displayOrder: 2,
  },
  {
    heading: 'Free Delivery Above ₹500',
    subHeading: 'Easy 7-day returns · Cash on Delivery available',
    buttonText: 'Start Shopping',
    buttonLink: '/shop',
    displayOrder: 3,
  },
];

const clothingSizes = ['S', 'M', 'L', 'XL'];

function variantsFor(skuPrefix, sizes, colours, stockFn = () => 10) {
  const variants = [];
  for (const colour of colours) {
    for (const size of sizes) {
      variants.push({
        options: { size, colour: colour.name, colourHex: colour.hex },
        sku: `${skuPrefix}-${colour.name.slice(0, 3).toUpperCase()}-${size.replace(/\s+/g, '')}`,
        stock: stockFn(size, colour.name),
      });
    }
  }
  return variants;
}

// `subCategory` values are category slugs, resolved to ids by the seeder
export const sampleProducts = [
  {
    name: 'Classic Cotton Crew T-Shirt (Sample)',
    subCategory: 'men-t-shirts',
    productType: 'clothing',
    gender: 'men',
    brand: 'SHOPME Basics',
    shortDescription: 'Soft, breathable everyday tee in 100% cotton.',
    description: 'A wardrobe essential with a regular fit and ribbed crew neck. Sample product for the design preview.',
    mrp: 799,
    sellingPrice: 399,
    attributes: { fabric: '100% Cotton', fit: 'regular', care: 'Machine wash cold. Do not bleach.' },
    variants: variantsFor('SHM-MTS', clothingSizes, [
      { name: 'Navy', hex: '#14213D' },
      { name: 'White', hex: '#FFFFFF' },
    ], (size) => (size === 'XL' ? 0 : 12)),
    tags: ['basics', 'summer'],
    isFeatured: true,
  },
  {
    name: 'Slim Fit Oxford Shirt (Sample)',
    subCategory: 'men-shirts',
    productType: 'clothing',
    gender: 'men',
    brand: 'SHOPME',
    shortDescription: 'Crisp oxford cotton shirt for work and weekends.',
    description: 'Button-down collar, slim fit and a soft oxford weave. Sample product for the design preview.',
    mrp: 1499,
    sellingPrice: 999,
    attributes: { fabric: 'Cotton Oxford', fit: 'slim', care: 'Machine wash. Warm iron.' },
    variants: variantsFor('SHM-MSH', clothingSizes, [{ name: 'Sky Blue', hex: '#87CEEB' }], (size) => (size === 'S' ? 2 : 8)),
    tags: ['formal', 'office'],
    isFeatured: true,
  },
  {
    name: 'Stretch Denim Jeans (Sample)',
    subCategory: 'men-jeans-trousers',
    productType: 'clothing',
    gender: 'men',
    brand: 'SHOPME Denim',
    shortDescription: 'Comfort-stretch denim with a modern tapered leg.',
    description: 'Mid-rise, five-pocket jeans with added stretch for all-day comfort. Sample product for the design preview.',
    mrp: 1999,
    sellingPrice: 1299,
    attributes: { fabric: '98% Cotton, 2% Elastane', fit: 'slim', care: 'Wash inside out.' },
    variants: variantsFor('SHM-MJN', ['30', '32', '34', '36'], [{ name: 'Indigo', hex: '#3F51B5' }]),
    tags: ['denim'],
  },
  {
    name: 'Floral Print Maxi Dress (Sample)',
    subCategory: 'women-dresses',
    productType: 'clothing',
    gender: 'women',
    brand: 'SHOPME Women',
    shortDescription: 'Flowy floral maxi dress for brunches and holidays.',
    description: 'Lightweight rayon maxi with a flattering waist tie and flutter sleeves. Sample product for the design preview.',
    mrp: 2499,
    sellingPrice: 1499,
    attributes: { fabric: 'Rayon', fit: 'relaxed', occasion: 'Casual', care: 'Hand wash cold.' },
    variants: variantsFor('SHM-WDR', ['XS', 'S', 'M', 'L'], [
      { name: 'Peach', hex: '#FFCBA4' },
      { name: 'Teal', hex: '#008080' },
    ]),
    tags: ['party wear', 'summer'],
    isFeatured: true,
    isNewArrival: true,
  },
  {
    name: 'Embroidered Cotton Kurti (Sample)',
    subCategory: 'women-kurtis-ethnic-wear',
    productType: 'clothing',
    gender: 'women',
    brand: 'SHOPME Ethnic',
    shortDescription: 'Straight-cut kurti with delicate thread embroidery.',
    description: 'Breathable cotton kurti with a mandarin collar and three-quarter sleeves. Sample product for the design preview.',
    mrp: 1299,
    sellingPrice: 799,
    attributes: { fabric: 'Cotton', fit: 'regular', occasion: 'Festive', care: 'Gentle machine wash.' },
    variants: variantsFor('SHM-WKU', clothingSizes, [{ name: 'Mustard', hex: '#E1AD01' }], (size) => (size === 'M' ? 3 : 9)),
    tags: ['ethnic', 'festive'],
    isNewArrival: true,
  },
  {
    name: 'Structured Tote Bag (Sample)',
    subCategory: 'women-bags',
    productType: 'fashion',
    gender: 'women',
    brand: 'SHOPME Fashion',
    shortDescription: 'Roomy vegan-leather tote with zip closure.',
    description: 'Fits a laptop up to 14 inches, with an inner zip pocket. Sample product for the design preview.',
    mrp: 1899,
    sellingPrice: 1199,
    attributes: { fabric: 'Vegan leather' },
    variants: variantsFor('SHM-WBG', ['One Size'], [
      { name: 'Tan', hex: '#D2B48C' },
      { name: 'Black', hex: '#111111' },
    ]),
    tags: ['bags', 'office'],
    isFeatured: true,
  },
  {
    name: 'Matte Liquid Lipstick (Sample)',
    subCategory: 'women-makeup',
    productType: 'beauty',
    gender: 'women',
    brand: 'SHOPME Beauty',
    shortDescription: 'Long-wear matte finish that stays comfortable.',
    description: 'Highly pigmented, transfer-resistant liquid lipstick. Sample product for the design preview.',
    mrp: 599,
    sellingPrice: 449,
    attributes: { ingredients: 'See pack', howToUse: 'Apply from the centre of the lips outwards.', shelfLife: '24 months' },
    variants: ['Ruby Red', 'Nude Pink', 'Berry'].map((shade) => ({
      options: { shade, volume: '4 g' },
      sku: `SHM-WLP-${shade.replace(/\s+/g, '').slice(0, 5).toUpperCase()}`,
      stock: 20,
    })),
    tags: ['makeup', 'lipstick'],
    isReturnable: false,
    isNewArrival: true,
  },
  {
    name: 'Gold-Tone Hoop Earrings (Sample)',
    subCategory: 'women-jewellery',
    productType: 'accessories',
    gender: 'women',
    brand: 'SHOPME Accessories',
    shortDescription: 'Lightweight everyday hoops with a polished finish.',
    description: 'Hypoallergenic, nickel-free hoops that go with everything. Sample product for the design preview.',
    mrp: 699,
    sellingPrice: 349,
    attributes: {},
    variants: variantsFor('SHM-WER', ['One Size'], [
      { name: 'Gold', hex: '#D4AF37' },
      { name: 'Silver', hex: '#C0C0C0' },
    ]),
    tags: ['jewellery'],
  },
];

export const defaultPages = {
  about:
    'SHOPME brings you modern, affordable fashion for men and women, from everyday clothing to beauty and accessories. (Replace this with your brand story in Business Settings.)',
  // Privacy Policy, Terms & Conditions and Refund & Cancellation Policy (src/content/legal)
  ...LEGAL_PAGES,
  // Shipping Policy and FAQ (src/content/legal)
  ...INFO_PAGES,
};
