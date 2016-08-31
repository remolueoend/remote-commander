const express = require('express'),
      extend = require('extend'),
      App = require('./lib/App'),
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
      };

const app = new App(express(), extend({}, defOpts, program));
app.listen();


