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
var     debug = require ('debug'),
        irc = require ('irc'),
        proxy = require ('./proxy.js');

/**
 * Constructs a new Bot instance.
 * @param clientList The client list.
 * @param config The global configuration.
 * @param serverConfig The server configuration.
 * @constructor
 */
var Bot = function (clientList, config, serverConfig) {
        "use strict";

        this.clientList = clientList;
        this.config = config;
        this.serverConfig = serverConfig;

        this.debug = debug ('irc-bridge:' + this.getIdentifier ());
        this.connection = null;

        this.initialize ();
};

/**
 * Initializes the bot instance.
 */
Bot.prototype.initialize = function () {
        "use strict";

        this.connection = new irc.Client (this.serverConfig.address, this.config.nickname, {
                userName: this.config.ident,
                realName: this.config.realname,
                port: this.serverConfig.port,
                secure: this.serverConfig.secure,
                channels: this.serverConfig.channels
        });

        this.connection.addListener ('registered', proxy (this.onRegistered, this));
        this.connection.addListener ('message#', proxy (this.onMessage, this));
        this.connection.addListener ('action', proxy (this.onAction, this));
        this.connection.addListener ('join', proxy (this.onJoin, this));
        this.connection.addListener ('kick', proxy (this.onKick, this));
        this.connection.addListener ('part', proxy (this.onPart, this));
        this.connection.addListener ('quit', proxy (this.onQuit, this));
        this.connection.addListener ('nick', proxy (this.onNick, this));
};

/**
 * Applies a method to all registered clients.
 * @param method The method.
 */
Bot.prototype.forward = function (method) {
        for (var i = 0, length = this.clientList.length; i < length; i++) {
                var client = this.clientList[i];

                if (client == this) {
                        this.debug ('Skipping myself!');
                        continue;
                }

                method.apply (this, [client]);
        }
};

/**
 * Handles successful connection registrations.
 * @param message The first message.
 */
Bot.prototype.onRegistered = function (message) {
        "use strict";

        this.debug ("Registered with server.");
        this.connection.send ("MODE", this.connection.nick, this.serverConfig.modes);
};

/**
 * Handles channel messages.
 * @param nick The user nickname.
 * @param to The target channel.
 * @param text The message text.
 * @param message The parsed message.
 */
Bot.prototype.onMessage = function (nick, to, text, message) {
        "use strict";

        this.debug ('Received message on ' + this.getIdentifier ())
        this.forward (function (client) {
                client.sendMessage ('(' + this.getIdentifier() + ':' + this.breakPing (nick) + ') ' + text);
        });
};

/**
 * Handles actions.
 * @param from The user nickname.
 * @param to The target channel.
 * @param text The message text.
 * @param message The parsed message.
 */
Bot.prototype.onAction = function (from, to, text, message) {
        "use strict";

        this.debug ('Received action on ' + this.getIdentifier ());
        this.forward (function (client) {
                client.sendAction ('(' + this.getIdentifier () + ':' + this.breakPing (from) + ') ' + text);
        });
};

/**
 * Handles joins.
 * @param channel The channel.
 * @param nickname The nickname.
 * @param message The parsed message.
 */
Bot.prototype.onJoin = function (channel, nickname, message) {
        "use strict";

        this.debug ('Received join on ' + this.getIdentifier ());
        if (nickname == this.connection.nick) {
                this.debug ('Skipping own join!');
                return;
        }

        this.forward (function (client) {
                client.sendMessage (this.getIdentifier () + ':' + this.breakPing (nickname) + ' has joined');
        });
};

/**
 * Handles kicks.
 * @param channel The channel.
 * @param nickname The nick of the kicked person.
 * @param by The moderator that kicked.
 * @param reason The kick reason.
 * @param message The parsed message.
 */
Bot.prototype.onKick = function (channel, nickname, by, reason, message) {
        "use strict";

        this.debug ('Received kick on ' + this.getIdentifier ());
        this.forward (function (client) {
                client.sendMessage (this.getIdentifier () + ':' + this.breakPing (by) + ' has kicked ' + this.breakPing (nickname) + ' (' + reason + ')');
        });
};

/**
 * Handles parts.
 * @param channel The channel.
 * @param nick The nick.
 * @param reason The reason.
 * @param message The parsed message.
 */
Bot.prototype.onPart = function (channel, nick, reason, message) {
        "use strict";

        this.debug ('Received part on ' + this.getIdentifier ());
        this.forward (function (client) {
                client.sendMessage (this.getIdentifier () + ':' + this.breakPing (nick) + ' has left' + (reason != undefined ? ' (' + reason + ')' : ''));
        });
};

/**
 * Handles quits.
 * @param nickname The nickname.
 * @param channels The channels the user was in.
 * @param reason The reason.
 * @param message The parsed message.
 */
Bot.prototype.onQuit = function (nickname, reason, channels, message) {
        "use strict";

        this.debug ('Received quit on ' + this.getIdentifier ());
        this.forward (function (client) {
                client.sendMessage (this.getIdentifier () + ':' + this.breakPing (nickname) + ' has quit (' + reason + ')');
        });
};

/**
 * Handles nickname changes.
 * @param oldNickname The old nickname.
 * @param newNickname The new nickname.
 * @param channels The channels the user is in.
 * @param message The parsed message.whoo
 */
Bot.prototype.onNick = function (oldNickname, newNickname, channels, message) {
        "use strict";

        this.debug ('Received nick change on ' + this.getIdentifier ());
        this.forward (function (client) {
                client.sendMessage (this.getIdentifier () + ':' + this.breakPing (oldNickname) + ' is now known as ' + this.breakPing (newNickname));
        });
};

/**
 * Inserts color codes into nicknames to prevent pings.
 * @param nickname The nickname.
 * @returns {string} The mutated nickname.
 */
Bot.prototype.breakPing = function (nickname) {
        "use strict";

        return nickname.substr (0, 1) + "\x1F" + "\x1F" + nickname.substr (1);
};

/**
 * Sends a message to all channels handled by the client.
 * @param message The message.
 */
Bot.prototype.sendMessage = function (message) {
        for (var i = 0, length = this.serverConfig.channels.length; i < length; i++) {
                var channel = this.serverConfig.channels[i];
                this.debug ('Forwarding to ' + this.getIdentifier () + ':' + channel);
                this.connection.say (channel, message);
        }
};

/**
 * Sends an action to all channels handled by the client.
 * @param message The message.
 */
Bot.prototype.sendAction = function (message) {
        "use strict";

        for (var i = 0, length = this.serverConfig.channels.length; i < length; i++) {
                var channel = this.serverConfig.channels[i];
                this.debug ('Forwarding to ' + this.getIdentifier () + ':' + channel);
                this.connection.action (channel, message);
        }
};

/**
 * Retrieves the client identifier.
 * @returns {string} The identifier.
 */
Bot.prototype.getIdentifier = function () {
        "use strict";
        return this.serverConfig.identifier;
};

module.exports = Bot;
