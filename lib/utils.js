/** @module utils */
"use strict";
var request = require('request'),
    _ = require('underscore'),
    heimdallrClient = require('./heimdallr-client.js');

var options = {
        encoding: 'utf-8',
        headers: {
            'content-type': 'application/json',
            'authorization': 'Token '
        },
        json: true
    },
    privateOptions = {
        authSource: 'heimdallr',
        url: heimdallrClient.Consumer.prototype.url
    };

function setPrivate(options) {
    _.extend(privateOptions, options);
}

function callback(err, res, body) {
    if (err) {
        console.log('ERR:', err);
    }
    if (res) {
        console.log('STATUS:', res.statusCode);
    }
    if (body) {
        console.log('BODY:', body);
    }
}

/**
 * This is a convenience function for posting packet schemas to the
 * Heimdallr server. The top-level keys for packetSchemas should be
 * one or more of 'event', 'sensor', and 'control'. The value of
 * these fields should be an object whose keys are the names of the
 * packet subtypes and whose values are valid JSON schema.
 *
 * @func postSchemas
 * @arg {string} token - Authentication token.
 * @arg {string|array} uuids - A single UUID or a list of UUIDs of the
 *    provider(s) that the packet schemas are for.
 * @arg {object} packetSchemas - The packet schemas.
 */
function postSchemas(token, uuids, packetSchemas) {
    var i,
        packetType;

    options.headers.authorization += token;
    if (!(uuids instanceof Array)) {
        uuids = [uuids];
    }
    packetSchemas = packetSchemas || {};

    options.qs = {authSource: privateOptions.authSource};
    for (i = 0; i < uuids.length; i++) {
        options.url = privateOptions.url + '/api/v1/provider/' +
            uuids[i] + '/subtype-schemas';

        for (packetType in packetSchemas) {
            if (packetSchemas.hasOwnProperty(packetType)) {
                options.body = {
                    packetType: packetType,
                    packetSchemas: packetSchemas[packetType]
                };
                request.post(options, callback);
            }
        }
    }
}

module.exports = {
    postSchemas: postSchemas,
    setPrivate: setPrivate
};