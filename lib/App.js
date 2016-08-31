const auth = require('http-auth'),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    CommandProvider = require('./CommandProvider'),
    Executor = require('./Executor'),
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

    const basic = auth.basic({
      realm: 'Remote Command Executer',
      file: config.auth_file
    });

    app.use(bodyParser.json());
    app.use(auth.connect(basic));
    app.use(morgan('combined'));
    app.post('/execute/:name', this.onExecute.bind(this));

    this.cmdProvider = new CommandProvider(config.command_file);
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
      res.sendStatus(ex.code || 400);
      res.end();
    }

  }

  /**
   * Validates the provided config properties.
   * @name   checkConfig
   * @param  {object} cfg     Config object to validate.
   */
  checkConfig (cfg) {
    try{
      cfg.command_file = path.resolve('', cfg.command_file);
      cfg.auth_file = path.resolve('', cfg.auth_file);
      fs.accessSync(cfg.command_file, fs.constants.F_OK | fs.constants.R_OK);
      fs.accessSync(cfg.auth_file, fs.constants.F_OK | fs.constants.R_OK);
    } catch (ex) {
      throw new Error(`Cannot access provided file:\n ${inspect(ex)}`);
    }
  }

  /**
   * Starts the express http listener.
   * @name   listen
   */
  listen() {
    this.app.listen(this.config.port);
    console.info('-- remote commander is listening on port ' + this.config.port);
  }

};