let express = require('express'),
    auth = require('http-auth'),
    extend = require('extend'),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    spawn = require('child_process').spawn,
    fs = require('fs'),
    watcher = require('filewatcher')(),
    util = require('util'),
    program = require('commander')
      .version('1.0.0')
      .option('-a, --auth_file [path]', 'Path to the passwd authentication file.')
      .option('-c, --command_file [path]', 'Path to thecommand definition file.')
      .option('-p, --port <n>', 'Optional port number', parseInt)
      .parse(process.argv),
    defOpts = {
      auth_file: './users.passwd',
      command_file: './commands.json',
      port: 8090
    },
    opts = extend({}, defOpts, program),
    basic = auth.basic({
      realm: 'Remote Command Executer',
      file: opts.auth_file
    }),
    app = express();

app.use(bodyParser.json());
app.use(auth.connect(basic));
app.use(morgan('combined'));

app.post('/execute/:name', onExecute);

onStartup().then(
  () => console.log(`listening on ${opts.port}.`),
  err => console.error(`Failed to start commander: ${util.inspect(err)}`)
);


function onExecute (req, res, next) {
  let cmdDef = app.remote_commands.filter((c => c.name === req.params.name))[0];
  
  // return 404 if cmd does not exist:
  if (!cmdDef) return next();
  
  // return 403 if user is denied or not allowed:
  if ((cmdDef.allowed && !cmdDef.allowed.includes(req.user)) || (cmdDef.denied && cmdDef.denied.includes(req.user))) {
    return res.sendStatus(403);
  }

  let args = {};
  if (cmdDef.allowed_args) {
    for (let a of cmdDef.allowed_args) {
      if (req.body.hasOwnProperty(a)) {
        args[a] = req.body[a];
      }
    }
  }
  extend(args, cmdDef.args);
  let argsArr = [];
  for (let a in args) {
    if (args.hasOwnProperty(a)) {
      let str = a;
      if (args[a] && args[a].length) {
        str += (' ' + args[a]);
      }
      argsArr.push(str);
    }
  }

  let out = '', err = '';
  let cmd = spawn(cmdDef.path, argsArr, { cwd: cmdDef.cwd });
  cmd.stdout.on('data', d => {
    out += d;
  });
  cmd.stderr.on('data', d => {
    err += d;
  });
  cmd.on('close', c => {
    res.json({out, err, c}).end();
  });



}

function onStartup () {
  return Promise.all([checkPath(opts.auth_file), checkPath(opts.command_file)])
  .then(() => {
    app.remote_commands = loadCommands(opts.command_file);
    watcher.add(opts.command_file);
    watcher.on('change', (f, s) => {
      if(!s) throw new Error(`command definition file at ${path} was deleted.`);
      app.remote_commands = loadCommands(f);
      console.info(`-- reloaded command definition file at ${f}.`);
    });

    app.listen(opts.port);
  });
}

function checkPath (path) {
  return new Promise((resolve, reject) => {
    fs.access(path, fs.constants.F_OK | fs.constants.R_OK, err => {
      if (err) return reject(new Error(`Cannot access file at ${path}.`));
      resolve();
    });
  });
}

function loadCommands (path) {
  try {
    return require(path);
  } catch(ex) {
    throw new Error(`Could not load commands file at ${path}: ${util.inspect(ex)}`);
  }
}