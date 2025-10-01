exports.recordManualPayment({amount, currency, payerName, receiptNumber, description}) {
  try {
    const payment = new Payments({
      payment_method: 'Manual',
      amount,
      currency,
      description,
      status: 'completed',
      manual_payment_details: {payerName, receiptNumber},
    });

    await payment.save();
    console.log('Manual payment recorded:', payment);
    return payment;
  } catch (error) {
    console.error('Error recording manual payment:', error.message);
    throw error;
  }
}

