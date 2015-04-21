"use strict";

var request = require('request'),
    tokens = {
        consumer: '7c5ffd18-ed5c-4146-9610-5beabdd9099a',
        provider: 'aac995a3-03f4-4f78-a793-fe7ec8d4f961'
    },
    uuids = {
        consumer: '19d1720c-9796-4ae9-aff3-1f3ed9b1fc3d',
        provider: 'f2af84a5-b361-4875-bf5a-05fa9949facb'
    },
    schemas,
    options,
    packetType;

schemas = {
    event: {
        status: {type: 'string'},
        power: {type: 'boolean'}
    },
    sensor: {
        temperature: {type: 'number'},
        accelerometer: {
            type: 'object',
            properties: {
                x: {type: 'number'},
                y: {type: 'number'},
                z: {type: 'number'}
            }
        }
    },
    control: {
        turnLeft: {type: 'null'},
        turnRight: {type: 'null'},
        accelerate: {
            type: 'object',
            properties: {
                direction: {type: 'string', enum: ['x', 'y', 'z']},
                magnitude: {type: 'number'}
            }
        }
    }
};

function handleResponse(err, res) {
    if (err) {
        console.log('ERROR:', err);
    }
    if (res) {
        console.log('STATUS:', res.statusCode);
    }
}

options = {
    url: 'https://heimdallr.skyforge.co/api/v1/provider/' + uuids.provider + '/subtype-schemas',
    encoding: 'utf-8',
    headers: {
        'content-type': 'application/json',
        'authorization': 'Token ' + tokens.consumer
    },
    json: true
};

for (packetType in schemas) {
    if (schemas.hasOwnProperty(packetType)) {
        options.body = {packetType: packetType, subtypeSchemas: schemas[packetType]};
        request.post(options, handleResponse);
    }
}