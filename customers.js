const makeCrudRouter = require('./_crudFactory');
module.exports = makeCrudRouter('customers', { requiredFields: ['name'] });
