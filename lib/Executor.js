const extend = require('extend'),
    spawn = require('child_process').spawn,
    HttpError = require('./HttpError'),
    inspect = require('util').inspect,
    EventEmitter = require('events').EventEmitter;


module.exports = class Executor extends EventEmitter {

  constructor(user, cmdConf, clientArgs){
    super();
    this.user = user;
    this.conf = cmdConf;
    this.clientArgs = clientArgs;
  }

  /**
   * Starts the execution of an executable.
   * @name   start
   */
  start() {
    // return 403 if user is denied or not allowed:
    if ((this.conf.allowed && !this.conf.allowed.includes(this.user)) || 
        (this.conf.denied && this.conf.denied.includes(this.user))) {
      throw new HttpError('Not allowed to execute this command', 403);
    }

    // Get allowed args from request body:
    let args = {};
    if (this.conf.allowed_args) {
      for (let a of this.conf.allowed_args) {
        if (this.clientArgs.hasOwnProperty(a)) {
          args[a] = this.clientArgs[a];
        }
      }
    }

    // Overwrite agrs with defined args in cmd def:
    extend(args, this.conf.args);
    // refromat args to string array:
    const argsArr = [];
    for (const a in args) {
      if (args.hasOwnProperty(a)) {
        let str = a;
        if (args[a] && args[a].length) {
          str += (' ' + args[a]);
        }
        argsArr.push(str);
      }
    }

    let out = '', err = '', cmd;
    try {
      cmd = spawn(this.conf.path, argsArr, {
        cwd: this.conf.cwd || __dirname
      });
    } catch(err) {
      throw new Error(`Could not spawn process\n: ${inspect(err)}`);
    }
    cmd.stdout.on('data', d => {
      out += d;
    });
    cmd.stderr.on('data', d => {
      err += d;
    });
    cmd.on('close', c => {
      this.emit('stop', {out, err, c});
    });

    cmd.on('error', err => {
      this.emit('error', err);
    });
  }
}