let joi  = require('joi');

module.exports = joi.array().items(joi.object().keys({
  name: joi.string().required(),
  path: joi.string().required(),
  cwd: joi.string().optional(),
  args: joi.string().optional(),
  allowed: joi.array().items(joi.string()),
  denied: joi.array().items(joi.string()),
  allowed_args: joi.array().items(joi.string()).optional()
}).xor('allowed', 'denied'));