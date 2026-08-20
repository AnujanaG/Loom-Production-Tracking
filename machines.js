const makeCrudRouter = require('./_crudFactory');
module.exports = makeCrudRouter('machines', { requiredFields: ['name'] });
