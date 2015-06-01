#!/usr/bin/env node
/*
 * Copyright 2015 Johannes Donath <johannesd@torchmind.com>
 * and other copyright owners as documented in the project's IP log.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * 	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var     config = require ('../config.json'),
        debug = require ('debug') ('irc-bridge:irc'),
        program = require ('commander'),
        bot = require ('../lib/bot.js');

// handle commandline arguments
program
        .version('0.0.1')
        .parse(process.argv);

// initialize clients
var clients = [];

for (var i = 0, len0 = config.servers.length; i < len0; i++) {
        var server = config.servers[i];

        debug ("Connecting to " + server.address);
        clients.push (new bot (clients, config, server));
}
