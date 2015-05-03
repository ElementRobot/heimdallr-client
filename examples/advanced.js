"use strict";

var heimdallrClient = require('heimdallr-client'),
    tokens = {
        consumer: <consumerToken>,
        provider: <providerToken>
    },
    uuids = {
        consumer: <consumerUUID>,
        provider: <providerUUID>
    },
    provider,
    consumer,
    streaming = false;

function stream() {
    var data = new ArrayBuffer(8),
        i;

    if (!streaming) {
        return;
    }

    for (i = 0; i < data.byteLength; i++) {
        data[i] = Math.round(Math.random());
    }
    provider.sendStream(data);
    setTimeout(stream, 100);
}

// Make a new provider
provider = new heimdallrClient.Provider(tokens.provider);
provider.on('err', function (err) {
    // Faceplant
    throw new Error(err);
}).on('control', function (packet) {
    if (packet.subtype === 'stream' && packet.data === 'start') {
        provider.sendSensor('accelerometer', {x: 0, y: 0, z: 100});
        streaming = true;
        stream();
    } else if (packet.subtype === 'stream' && packet.data === 'stop') {
        streaming = false;
    }
});
provider.connect();

// Make a fake temperature every second and send the measured value to the Heimdallr server
(function readTemperature() {
    console.log('PROVIDER: sending temperature');
    provider.sendSensor('temperature', Math.random() * 40 + 50);
    setTimeout(readTemperature, 1000);
}());

// Make a new consumer
consumer = new heimdallrClient.Consumer(tokens.consumer);
consumer.removeListener('err');  // Remove the default error handler
consumer.on('err', function (err) {
    console.log('This looks like a nice error:', err);
    // Faceplant
    throw new Error(err);
}).on('auth-success', function () {
    // We've successfully authenticated with the Heimdallr server.
    // Now we can subscribe to providers we want to interact with.
    consumer.subscribe(uuids.provider);

    // Will only receive accelerometer sensor packets
    // To clear the filter: consumer.setFilter(uuids.provider, {sensor: []});
    consumer.setFilter(uuids.provider, {sensor: ['accelerometer']});
}).on('sensor', function (packet) {
    // packet.provider tells us who sent the sensor packet.
    console.log('RECVD %s:', packet.subtype, packet.data);
}).on('stream', function (packet) {
    // packet also has a provider field that indicates the source
    console.log(packet.stream.toString('base64'));
});
consumer.connect();

// Want to stream data from this provider
consumer.joinStream(uuids.provider);

setTimeout(function () {
    // Want to stop streaming data from this provider
    consumer.leaveStream(uuids.provider);
}, 3 * 1000);

setTimeout(function () {
    // We don't have a schema for this so it will trigger an 'err' event
    consumer.sendControl(uuids.provider, 'woops', null);
}, 4 * 1000);