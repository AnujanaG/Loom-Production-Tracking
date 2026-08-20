const makeCrudRouter = require('./_crudFactory');

module.exports = makeCrudRouter('expenses', {
  requiredFields: ['expense_date', 'expense_type', 'category', 'amount'],
  numericFields: ['amount'],
  dateFields: ['expense_date'],
  // Direct expenses must always be linked to an employee (that's the whole point of "direct").
  customValidate: (body) => {
    if (body.expense_type === 'direct' && !body.employee_id) {
      return 'Direct expenses must be linked to an employee';
    }
    if (body.expense_type && !['direct', 'indirect'].includes(body.expense_type)) {
      return 'expense_type must be "direct" or "indirect"';
    }
    return null;
  }
});
