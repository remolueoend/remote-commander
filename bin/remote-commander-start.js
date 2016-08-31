#!/usr/bin/env node

const express = require('express'),
      App = require('../lib/App'),
      output = require('../lib/output'),
      program = require('commander')
      .description('starts a listener for incoming requests on the given port.')
        .option('-a, --auth-file [./users.passwd]', 'Path to the passwd authentication file.', './users.htpasswd')
        .option('-c, --command-file [./commands.json]', 'Path to the command definition file.', 'commands.json')
        .option('-p, --port [8090]', 'Optional port number', 8090, parseInt)
        .option('-b, --basic', 'Use basic auth instead of digest auth.')
        .option('-l, --log-dir [path]', 'Path to the log directory.')
        .parse(process.argv);

let app;
try {
  app = new App(express(), program);
} catch(err) {
  output.error('Could not start remote-commander', err);
}

try {
  app.listen();
} catch (err) {
  output.error(`Error while starting listener on ${program.port}`, err);
}


