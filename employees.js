const makeCrudRouter = require('./_crudFactory');
module.exports = makeCrudRouter('employees', {
  requiredFields: ['name'],
  dateFields: ['join_date']
});
