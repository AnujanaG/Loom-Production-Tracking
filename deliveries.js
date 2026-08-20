const makeCrudRouter = require('./_crudFactory');

module.exports = makeCrudRouter('deliveries', {
  // customer_id is intentionally NOT required here - it's only required for
  // 'sale' type deliveries, checked below in customValidate. product_id and
  // delivered_qty apply to both sale and own_use records.
  requiredFields: ['delivery_date', 'product_id', 'delivered_qty', 'delivery_type'],
  numericFields: ['delivered_qty', 'approved_qty', 'rejected_qty', 'bill_amount'],
  dateFields: ['delivery_date'],
  customValidate: (body) => {
    const delivered = Number(body.delivered_qty || 0);
    const approved = Number(body.approved_qty || 0);
    const rejected = Number(body.rejected_qty || 0);
    if (approved + rejected > delivered) {
      return 'Approved + rejected quantity cannot exceed delivered quantity';
    }
    if (body.delivery_type && !['sale', 'own_use'].includes(body.delivery_type)) {
      return 'delivery_type must be "sale" or "own_use"';
    }
    if (body.delivery_type === 'sale' && !body.customer_id) {
      return 'A customer is required for sale-type deliveries';
    }
    return null;
  }
});
