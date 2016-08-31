#!/usr/bin/env node

const output = require('../lib/output'),
      htpasswd = require('htpasswd/gensrc/processor'),
      path = require('path'),
      program = require('commander')
        .usage('username [auth-file=./users.htpasswd]')
        .description('deletes a user in the provided passwd-file.')
        .parse(process.argv);

if(program.args.length < 1) {
  program.help();
}

htpasswd.exec({
  delete: true,
  args: [
    program.args[1] || path.resolve('', './users.htpasswd'),
    program.args[0]
  ],
});