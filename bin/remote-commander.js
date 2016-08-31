#!/usr/bin/env node

const express = require('express'),
      extend = require('extend'),
      package = require('../package.json'),
      program = require('commander')
        .usage('[command] [options]')
        .version(package.version)
        .command('start', 'starts a listener for incoming requests on the given port.', {isDefault: true})
        .command('chuser', 'creates or changes a user in the provided passwd-file.')
        .command('rmuser', 'deletes a user in the provided passwd-file.')
        .parse(process.argv);


