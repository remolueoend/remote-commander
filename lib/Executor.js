const extend = require('extend'),
    output = require('./output'),
    spawn = require('child_process').spawn,
    HttpError = require('./HttpError'),
    inspect = require('util').inspect,
    MemoryStream = require('memorystream'),
    CmdNotification = require('./notifier').CmdNotification,
    EventEmitter = require('events').EventEmitter,
    uuid = require('node-uuid');

const __execs = {};
const argsRegex = /\$\{(.*?)=(.*?)\}/g;

function kill(cmdID) {
  if(__execs[cmdID]) {
    __execs[cmdID].cmd.kill();
    process.kill(__execs[cmdID].cmd.pid, 'SIGTERM');
    process.kill(__execs[cmdID].cmd.pid, 'SIGKILL');
    return true;
  }
  return false;
}

function getUserTasks(username) {
  const res = [];
  for(let id of Object.getOwnPropertyNames(__execs)) {
    let cmd = __execs[id];
    if(cmd.user === username) res.push(cmd);
  }

  return res;
}

module.exports = class Executor extends EventEmitter {

  constructor(user, cmdConf, clientArgs){
    super();
    this.user = user;
    this.conf = cmdConf;
    this.id = uuid.v4();
    this.clientArgs = clientArgs;
    this.notifier = new CmdNotification(this.user, this.conf);
  }

  onCmdExit(){
    this.notifier.sendExit(this.id);
    delete __execs[this.id];
  }

  getArgsPlaceholders(args) {
    let m, result = [];
    while((m = argsRegex.exec(args)) !== null) {
      result.push({
        match: m[0],
        placeholder: m[1],
        default: m[2]
      });
    }

    return result;
  }



  /**
   * Starts the execution of an executable.
   * @name   start
   */
  start() {
    if(this.__started) throw new Error('Cannot start an already running executor.');
    this.__started = true;

    // return 403 if user is denied or not allowed:
    if ((this.conf.allowed && !this.conf.allowed.includes(this.user)) || 
        (this.conf.denied && this.conf.denied.includes(this.user))) {
      throw new HttpError('Not allowed to execute this command', 403);
    }

    let argsStr = this.conf.args;
    for(let m of this.getArgsPlaceholders(argsStr)) {
      argsStr = argsStr.replace(m.match, (this.clientArgs[m.placeholder] || m.default));
    }

    try {
      this.cmd = spawn(this.conf.path, argsStr.split(' '), {
        cwd: this.conf.cwd || process.cwd()
      });
      this.notifier.attachStreams(this.cmd.stdout, this.cmd.stderr);
      __execs[this.id] = this;
      output.att(`Spawned '${this.conf.name}' (${this.id}) by ${this.user}: ${this.conf.path} ${argsStr}`);

    } catch(err) {
      throw new Error(`Could not spawn process\n: ${inspect(err)}`);
    }

    this.cmd.on('exit', c => {
      this.notifier.send(`Finished with exit code ${c}`);
      this.onCmdExit();
      output.att(`Closing '${this.conf.name}' (${this.id}) by ${this.user}`);
    });

    this.cmd.on('error', err => {
      this.notifier.send(inspect(err), true);
      this.onCmdExit();
    });
  }
}

module.exports.kill = kill;
module.exports.getUserTasks = getUserTasks;