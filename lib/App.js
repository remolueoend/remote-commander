const auth = require('http-auth'),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    uuid = require('node-uuid'),
    FileStreamRotator = require('file-stream-rotator'),
    CommandProvider = require('./CommandProvider'),
    HttpError = require('./HttpError'),
    Executor = require('./Executor'),
    output = require('./output'),
    inspect = require('util').inspect,
    express = require('express'),
    fs = require('fs'),
    socket_io = require('socket.io'),
    extend = require('extend'),
    https = require('https'),
    notifier = require('./notifier'),
    path = require('path');

const SOCKET_PATH = '/socket.io/';

function sendFile(res, p) {
  res.sendFile(path.join(__dirname, '..', p));
}

/**
 * Adds the middleware handlers for remote commander to the provided
 * express instance.
 * @type {App}
 */
module.exports = class App {
  constructor(app, config) {
    this.config = this.checkConfig(config);
    this.app = app;
    this.server = https.createServer({
      key: fs.readFileSync(this.config.keyFile),
      cert: fs.readFileSync(this.config.certFile)
    }, app);
    
    this.io = socket_io(this.server, {
      path: SOCKET_PATH
    });

    this.authMethod = auth[this.config.basic ? 'basic' : 'digest']({
      realm: 'Remote Command Executer',
      file: this.config.authFile
    });

    this.injectListener(this.server);
    this.setupLog();

    app.set('views', path.join(__dirname, '../views'));
    app.set('view engine', 'ejs');

    app.use((req, res, next) => { req.id = uuid.v4(); next(); });
    app.use(bodyParser.json());
    app.use(express.static(path.join(__dirname, '../static')));
    app.use(express.static(path.join(__dirname, '../client')));
    app.use(auth.connect(this.authMethod));

    app.get('/', (req, res) => {
      // ng2: sendFile(res, 'client/bin/index.html');
      res.render('index');
    });
    app.get('/app', (req, res) => {
      res.render('app');
    });
    app.post('/execute/:name', this.onExecute.bind(this));
    app.post('/kill/:cmdid', (req, res, next) => {
      const result = Executor.kill(req.params.cmdid);
      res.status((result ? 200 : 500));
      res.end();
    });

    app.use((req, res, next) => {
      next(new HttpError('Requested Page or Command not found (404).', 404));
    });
    app.use((err, req, res, next) => {
      const s = err.statusCode > 0 ? err.statusCode : 500;
      res.status(s);
      res.end(err.message);
      //res.render('index', { err: true, msg: err.message });
    });

    this.io.on('connection', socket => {
      const username = socket.conn.request.user;
      notifier.addConn(username, socket);
      socket.emit('running', Executor.getUserTasks(username).map(t => ({
        name: t.conf.name,
        clientArgs: t.clientArgs,
        id: t.id
      })));
    });

    this.cmdProvider = new CommandProvider(this.config.commandFile);
  }

  /**
   * Request handler for remote commander URL.
   * @name   onExecute
   * @param  {Request}   req     Express request instance.
   * @param  {Response}   res     Express Response instance.
   * @param  {Function} next    Express next handler.
   */
  onExecute(req, res, next) {
    try {
      const cmdCfg = this.cmdProvider.getCmdCfg(req.params.name);
      if (!cmdCfg) return next();
      const executor = new Executor(req.user, cmdCfg, req.body);
      executor.start();
      res.end(executor.id);
    } catch(ex) {
      res.status(500);
      res.end(ex.message);
    }
  }

  setupLog() {
    morgan.token('id', req => {
      return req.id;
    });
    morgan.token('user', req => {
      return req.user || 'anon';
    });

    let accessLogStream;
    if (this.config.logDir) {
      accessLogStream = FileStreamRotator.getStream({
        date_format: 'YYYYMMDD',
        filename: path.join(this.config.logDir, 'access-%DATE%.log'),
        frequency: 'daily',
        verbose: false
      });
    }

    this.app.use(morgan(':id | :date | :user@:remote-addr | :method :url | :status', {
      stream: accessLogStream
    }));
  }

  /**
   * Validates the provided config properties.
   * @name   checkConfig
   * @param  {object} cfg     Config object to validate.
   */
  checkConfig (cfg) {
    const newCfg = extend({}, cfg);
    for(let f of ['commandFile', 'authFile', 'keyFile', 'certFile']) {
      newCfg[f] = path.resolve('', newCfg[f]);
      try{
        fs.accessSync(newCfg[f], fs.constants.F_OK | fs.constants.R_OK);
      } catch(err) {
        throw new Error(`Cannot access ${newCfg[f]}:\n ${inspect(err)}`);
      }
    }

    if (cfg.logDir) {
      try {
        fs.existsSync(cfg.logDir) || fs.mkdirSync(cfg.logDir)
      } catch(ex) {
        throw new Error(`Could not access or create log directory at ${cfg.logDir}:\n ${inspect(ex)}`);
      }
    }

    return newCfg;
  }

  /**
   * Starts the express http listener.
   * @name   listen
   */
  listen() {
    this.server.listen(this.config.port);
    output.info(`-- remote commander is listening on port ${this.config.port}\n   cwd is: ${process.cwd()}`);
  }

  injectListener(server) {
    const listeners = server.listeners('request').slice(0),
          _self = this;
    server.removeAllListeners('request');

    const next = (req, res) => {
      for (var i = 0, l = listeners.length; i < l; i++) {
        listeners[i].call(server, req, res);
      }
    };

    server.on('request', function(req, res){
      if(req.url.substr(0, SOCKET_PATH.length) === SOCKET_PATH) {
        auth.connect(_self.authMethod)(req, res, err => {
          if(err) {
            res.sendStatus(401);
          } else {
            next(req, res);
          }
        });
      } else {
        next(req, res);
      }
    });
  }

};
