const colors = require('colors/safe'),
      inspect = require('util').inspect;

module.exports = {
  info(message) {
    console.info(colors.green(message));
  },

  error(message, err) {
    let msg = message;
    if (err) msg += ':\n' + inspect(err);
    console.error(colors.red(msg));
  }
}