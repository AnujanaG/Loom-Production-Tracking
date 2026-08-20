const makeCrudRouter = require('./_crudFactory');
module.exports = makeCrudRouter('products', {
  requiredFields: ['name', 'code', 'rate', 'unit'],
  numericFields: ['rate']
});
