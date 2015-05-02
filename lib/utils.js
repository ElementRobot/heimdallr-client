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
    },
    finishedFn = function emptyFn() { return undefined; },
    results = {},
    numCallbacks;

function setPrivate(options) {
    _.extend(privateOptions, options);
}

function processResults(err, res, body) {
    // this is the UUID of the provider
    results[this] = {
        error: err,
        response: res,
        body: body
    };
    numCallbacks--;

    if (numCallbacks === 0) {
        finishedFn(results);
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
 * @arg {function} [fn] - Callback to run once all the POSTS have
 *    completed. It will be passed an object with keys that are the
 *    provider UUIDs and values that are the response from the POST.
 */
function postSchemas(token, uuids, packetSchemas, fn) {
    var i,
        packetType;

    options.headers.authorization += token;
    if (!(uuids instanceof Array)) {
        uuids = [uuids];
    }
    packetSchemas = packetSchemas || {};
    if (_.isFunction(fn)) {
        finishedFn = fn;
    }

    // Calculate the number of times the processResults should be called
    numCallbacks = uuids.length * Object.keys(packetSchemas).length;

    options.qs = {authSource: privateOptions.authSource};
    for (i = 0; i < uuids.length; i++) {
        options.url = privateOptions.url + '/api/v1/provider/' +
            uuids[i] + '/subtype-schemas';

        for (packetType in packetSchemas) {
            if (packetSchemas.hasOwnProperty(packetType)) {
                options.body = {
                    packetType: packetType,
                    subtypeSchemas: packetSchemas[packetType]
                };
                request.post(options, processResults.bind(uuids[i]));
            }
        }
    }
}

module.exports = {
    postSchemas: postSchemas,
    setPrivate: setPrivate
};