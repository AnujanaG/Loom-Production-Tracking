const makeCrudRouter = require('./_crudFactory');

module.exports = makeCrudRouter('cloth_types', {
  requiredFields: ['name', 'default_rate'],
  numericFields: ['default_rate']
});
