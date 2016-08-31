const auth = require('http-auth'),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    uuid = require('node-uuid'),
    FileStreamRotator = require('file-stream-rotator'),
    CommandProvider = require('./CommandProvider'),
    Executor = require('./Executor'),
    output = require('./output'),
    inspect = require('util').inspect,
    fs = require('fs'),
    path = require('path');

/**
 * Adds the middleware handlers for remote commander to the provided
 * express instance.
 * @type {App}
 */
module.exports = class App {
  constructor(app, config) {
    this.checkConfig(config);
    this.app = app;
    this.config = config;

    const basic = auth[config.basic ? 'basic' : 'digest']({
      realm: 'Remote Command Executer',
      file: config.authFile
    });

    this.setupLog();

    app.use((req, res, next) => { req.id = uuid.v4(); next(); });
    app.use(bodyParser.json());
    app.use(auth.connect(basic));

    app.post('/execute/:name', this.onExecute.bind(this));

    this.cmdProvider = new CommandProvider(config.commandFile);
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
      executor.on('stop', r => {
        res.json(r).end();
      });
      executor.start();
    } catch(ex) {
      //res.sendStatus(ex.code || 400);
      res.write(inspect(ex));
      res.end();
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
    try{
      cfg.commandFile = path.resolve('', cfg.commandFile);
      cfg.authFile = path.resolve('', cfg.authFile);
      fs.accessSync(cfg.commandFile, fs.constants.F_OK | fs.constants.R_OK);
      fs.accessSync(cfg.authFile, fs.constants.F_OK | fs.constants.R_OK);
    } catch (ex) {
      throw new Error(`Cannot access provided file:\n ${inspect(ex)}`);
    }

    if (cfg.logDir) {
      try {
        fs.existsSync(cfg.logDir) || fs.mkdirSync(cfg.logDir)
      } catch(ex) {
        throw new Error(`Could not access or create log directory at ${cfg.logDir}:\n ${inspect(ex)}`);
      }
    }
  }

  /**
   * Starts the express http listener.
   * @name   listen
   */
  listen() {
    this.app.listen(this.config.port);
    output.info('-- remote commander is listening on port ' + this.config.port);
  }

};
