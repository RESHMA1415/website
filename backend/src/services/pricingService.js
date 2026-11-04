// Money rules from PRD §6. All amounts are whole rupees.

// PRD §6.1: floor((MRP − selling) ÷ MRP × 100); 0 when there is no discount
export function discountPercent(mrp, sellingPrice) {
  if (!mrp || sellingPrice >= mrp) return 0;
  return Math.floor(((mrp - sellingPrice) / mrp) * 100);
}

export function variantPrice(product, variant) {
  return {
    mrp: variant?.mrp ?? product.mrp,
    price: variant?.price ?? product.sellingPrice,
  };
}

// PRD §6.2. `lines` are [{ mrp, price, quantity }] already resolved by the server.
export function calculateTotals(lines, settings, paymentMethod = 'online') {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const savings = lines.reduce((sum, line) => sum + Math.max(0, line.mrp - line.price) * line.quantity, 0);

  const { freeDeliveryThreshold, deliveryCharge: baseDeliveryCharge } = settings.delivery;
  const deliveryCharge = subtotal === 0 || subtotal >= freeDeliveryThreshold ? 0 : baseDeliveryCharge;
  const codCharge = paymentMethod === 'cod' ? settings.cod.charge : 0;
  const total = subtotal + deliveryCharge + codCharge;

  return {
    subtotal,
    deliveryCharge,
    codCharge,
    total,
    savings,
    amountForFreeDelivery: deliveryCharge > 0 ? freeDeliveryThreshold - subtotal : 0,
  };
}

// PRD §6.4: COD must be switched on and the order within the COD limit
export function isCodAllowed(totalWithCod, settings) {
  return settings.cod.enabled && totalWithCod <= settings.cod.maxOrderValue;
}
