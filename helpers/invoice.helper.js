export const buildInvoiceData = (order) => {

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
      transactionId: order.payment.razorpayPaymentId
    },

    items: order.items.map(item => ({
      name: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      total: item.itemTotal,
      status: item.status,
      refundedAmount: item.refundedAmount || 0
    })),

    pricing: {
      subtotal: order.pricing.subtotal,
      discount: order.pricing.discount || 0,
      tax: order.pricing.tax || 0,
      shippingCharge: order.pricing.shippingCharge || 0,
      totalAmount: order.pricing.totalAmount,
      refundedAmount: order.payment.refundedAmount || 0,
      netPaid: order.pricing.totalAmount - (order.payment.refundedAmount || 0)
    },
  };
};
