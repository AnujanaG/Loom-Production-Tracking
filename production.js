const makeCrudRouter = require('./_crudFactory');
module.exports = makeCrudRouter('production_entries', {
  requiredFields: ['production_date', 'machine_id', 'product_id', 'employee_id', 'quantity'],
  numericFields: ['quantity'],
  dateFields: ['production_date']
});
