export const buildInvoiceData = (order) => {
  // Items that were actually billed
  const invoiceItems = order.items.filter(item =>
    !(
      item.status === "CANCELLED" &&
      item.cancellation?.at &&
      order.payment.status !== "PAID"
    )
  );

  const subtotal = invoiceItems.reduce(
    (sum, item) => sum + item.itemTotal,
    0
  );

  return {
    invoiceNumber: `INV-${order.orderId}`,
    orderId: order.orderId,
    invoiceDate: order.payment.paidAt || order.createdAt,

    customer: {
      name: order.customerSnapshot.name,
      email: order.customerSnapshot.email
    },

    shippingAddress: order.shippingAddress,

    payment: {
      method: order.payment.method,
      status: order.payment.status,
    },

    items: invoiceItems.map(item => ({
      name: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      total: item.itemTotal,
    })),

    pricing: {
      subtotal,
      discount: order.pricing.discount || 0,
      tax: order.pricing.tax || 0,
      shippingCharge: order.pricing.shippingCharge || 0,
      totalAmount: order.pricing.totalAmount,
    },
  };
};
