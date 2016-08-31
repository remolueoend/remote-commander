#!/usr/bin/env node

const output = require('../lib/output'),
      htdigest = require('htdigest/gensrc/processor'),
      path = require('path'),
      program = require('commander')
        .usage('username [auth-file=./users.htpasswd] [options]')
        .description('creates or changes a user in the provided passwd-file.')
        .option('-c, --create', "Create a new file.")
        .parse(process.argv);

if(program.args.length < 1) {
  program.help();
}

htdigest.exec({
  args: [
    program.args[1] || path.resolve('', './users.htpasswd'),
    'Remote Command Executer',
    program.args[0]
  ],
  create: program.create
});