var request = require('request'),
    heimdallrClient = require('heidmallr-client'),
    tokens = {
        consumer: '7c5ffd18-ed5c-4146-9610-5beabdd9099a',
        provider: 'aac995a3-03f4-4f78-a793-fe7ec8d4f961'
    },
    uuids = {
        consumer: '19d1720c-9796-4ae9-aff3-1f3ed9b1fc3d',
        provider: 'f2af84a5-b361-4875-bf5a-05fa9949facb'
    },
    schemas = {
        event: {
            status: {
                type: 'string'
            },
            power: {
                type: 'boolean'
            }
        },
        sensor: {
            temperature: {
                type: 'number'
            },
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
                    direction: {
                        type: 'string',
                        enum: ['x', 'y', 'z'],
                    },
                    magnitude: {
                        type: 'number'
                    }
                }
            }
        }
    },
    provider,
    consumer;

// Post the schemas for our packet types
request = request.defaults({
    encoding: 'utf-8',
    headers: {
        'content-type': 'application/json',
        'authorization': 'Token ' + tokens.consumer
    },
    json: true
});

for(var packetType in schemas){
    request.post('http://heimdallr.skyforge.co/api/v1/provider/' + uuids.provider + '/subtype-schemas', {
        body: JSON.stringify({packetType: packetType, subtypeSchemas: schemas[packetType]})
    });
}

controlHandler = {
    turnLeft: function(){
        // It's a NASCAR thing
        provider.sendEvent('status', 'turned left');
    },
    turnRight: function(){
        // It's a Zoolander thing
        provider.sendEvent('status', 'turned right');
    },
    accelerate: function(packet){
        var accelerometerReading = {x: 0, y: 0, z: 0};

        // Our control system has a very good response
        accelerometerReading[packet.data.direction] = packet.data.magnitude;
        provider.sendSensor('accelerometer', accelerometerReading);

        if(packet.data.magnitude > 0){
            // I've got the power
            provider.sendEvent('power', true);
        }
        else{
            // I just can't do it cap'n!!
            provider.sendEvent('power', false);
        }
    }
};

provider = new heimdallrClient.Provider(tokens.provider);
provider.on('control', function(packet){
    controlHandler[packet.subtype](packet);
    if(packet.persistent){
        // Let the Heimdallr server know the control has been completed
        provider.completed(packet.persistent);
    }
});

(function updateTemperature(){
    provider.sendSensor('temperature', Math.random() * 40 + 50);
    setTimeout(updateTemperature, 5 * 1000);  // Every 5 seconds
})();

consumer = new heimdallrClient.consumer(tokens.consumer);
consumer.on('event', function(packet){
    if(packet.subtype === 'status'){
        console.log('status:', packet.data);
    }
    else if(packet.subtype === 'power'){
        console.log(packet.data ? 'blast off' : 'power down');
    }
}).on('sensor', function(packet){
    console.log('SENSOR %s: %s', packet.subtype, packet.data);
});



