let joi  = require('joi'),
    filewatcher = require('filewatcher'),
    cmdSchema = require('./cmd-schema'),
    util = require('util');

module.exports = class CommandProvider {
  constructor(path) {
    this.path = path;
    this.watcher = filewatcher();
    this.watcher.on('change', (f, s) => {
      if(s) {
        this.path = f;
        this.commands = this.parseFile(f);
        console.info(`-- reloaded command definition file at ${this.path}.`);
      }
    });
    this.watcher.add(this.path);
    this.commands = this.parseFile(this.path);
  }

  parseFile(path) {
    try {
      let raw = require(path);
      let res = joi.validate(raw, cmdSchema);
      if (res.error) throw new Error(`Invalid command definition file: ${util.inspect(res.error)}`);
        return res.value;
    } catch(ex) {
      throw new Error(`Could not load commands file at ${path}: ${util.inspect(ex)}`);
    }
  }

  getCmdCfg(name) {
    return this.commands.filter(c => c.name === name)[0];
  }
};