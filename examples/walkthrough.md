## Overview
This tutorial should demonstrate most of the functionality of Heimdallr-Client. This walkthrough will demonstrate using Heimdallr-Client in node.js. Heimdallr-Client can also be used in the browser and is available as a bower package. The authentication keys are fake so copy-pasting the code will not work. To get your own authentication keys just shoot us an [email](mailto:heimdallr@elementrobot.com).

## Getting Started
Install [node](http://nodejs.org/) if you don't have it. Then make a directory for your Heimdallr project to live in and grab the node packages we will be using:

```bash
mkdir heimdallr-project
cd heimdallr-project
npm install heimdallr-client request --save
```

Now open a new file

```bash
nano upload_schemas.js
```

add the folowing code


```javascript
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
    options;

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

function handleResponse(err, res, body){
    if(err) console.log('ERROR:', err);
    console.log('STATUS:', res.statusCode);
}

options = {
    url: 'http://heimdallr.skyforge.co/api/v1/provider/' + uuids.provider + '/subtype-schemas',
    encoding: 'utf-8',
    headers: {
        'content-type': 'application/json',
        'authorization': 'Token ' + tokens.consumer
    },
    json: true
};

for(var packetType in schemas){
    options.body = {packetType: packetType, subtypeSchemas: schemas[packetType]};
    request.post(options, handleResponse);
}
```

close the file with Ctrl+X Y [return] and run it with

```bash
node upload_schemas.js

# output
# STATUS: 200
# STATUS: 200
# STATUS: 200
```

What this does is tell the Heimdallr server what to expect for specific packet subtypes for a given provider. So now it knows that if it recieves an event packet with a status subtype that the data field should be a string. This is accomplished using [JSON Schema](http://json-schema.org/). If you haven't checked it out before, we strongly recommend doing so. A useful tool for getting acquainted with JSON schema is [JSON Schema Lint](http://jsonschemalint.com/). Schemas only need to be uploaded once per provider. New schemas can be uploaded at anytime. Keep in mind that any old schemas will be erased.

## Create a Provider
Now it's time to make a mock provider. The provider is a Heimdallr client that generates information. This information is sent to the Heimdallr server where it is stored. So make another file

```bash
nano walkthrough.js
```

add the following code

```javascript
var heimdallrClient = require('heimdallr-client'),
    tokens = {
        consumer: '7c5ffd18-ed5c-4146-9610-5beabdd9099a',
        provider: 'aac995a3-03f4-4f78-a793-fe7ec8d4f961'
    },
    uuids = {
        consumer: '19d1720c-9796-4ae9-aff3-1f3ed9b1fc3d',
        provider: 'f2af84a5-b361-4875-bf5a-05fa9949facb'
    },
    controlHandler,
    provider,
    consumer;

// Callbacks for the different control packet subtypes
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

        // If we accelerated, we've got power; if we decelerated, we've lost it
        provider.sendEvent('power', packet.data.magnitude > 0);

        // Our control system has a very good response
        accelerometerReading[packet.data.direction] = packet.data.magnitude;
        provider.sendSensor('accelerometer', accelerometerReading);
    }
};

// Make a new provider
provider = new heimdallrClient.Provider(tokens.provider);
provider.on('control', function(packet){
    controlHandler[packet.subtype](packet);
    if(packet.persistent){
        // Let the Heimdallr server know the control has been completed
        provider.completed(packet.persistent);
        console.log('PROVIDER: completed persistent control');
    }
});

// Make a fake temperature every second and send the measured value to the Heimdallr server
(function readTemperature(){
    console.log('PROVIDER: sending temperature');
    provider.sendSensor('temperature', Math.random() * 40 + 50);
    setTimeout(readTemperature, 1 * 1000);
})();
```

close the file with Ctrl+X Y [return] and run it with

```bash
node walkthrough.js

# output
# PROVIDER: sending temperature
```

When you've had enough, hit Ctrl+C to make it stop. So that's cool and all but it isn't really doing anything. Next we are going to add a consumer to the mix to make it a little more interesting.

## Create a Consumer
A consumer is a Heimdallr client that listens for information from providers. A consumer can also send controls to a provider. To see this in action append the following code to your walkthrough.js file

```javascript
// Make a new consumer
consumer = new heimdallrClient.Consumer(tokens.consumer);
consumer.on('auth-success', function(){
    // We've successfully authenticated with the Heimdallr server.
    // Now we can subscribe to providers we want to interact with.
    consumer.subscribe(uuids.provider);
}).on('event', function(packet){
    // packet.provider tells us who sent the sensor packet.
    if(packet.subtype === 'status'){
        console.log('RECVD status:', packet.data);
    }
    else if(packet.subtype === 'power'){
        console.log('RECVD ' + packet.data ? 'full power' : 'no power');
    }
}).on('sensor', function(packet){
    // packet.provider tells us who sent the sensor packet.
    console.log('RECVD %s:', packet.subtype, packet.data);
});

consumer.sendControl(uuids.provider, 'accelerate', {direction: 'x', magnitude: 10});
consumer.sendControl(uuids.provider, 'turnRight', null);
consumer.sendControl(uuids.provider, 'turnLeft', null);
consumer.sendControl(uuids.provider, 'accelerate', {direction: 'x', magnitude: 0});

setTimeout(function(){
    console.log('GETTING STATE');
    consumer.getState(uuids.provider, ['status', 'power']);
}, 2 * 1000);

setTimeout(function(){
    // Sends a persistent control
    consumer.sendControl(uuids.provider, 'turnRight', null, true);
}, 3 * 1000);
```

and run it with

```bash
node walkthrough.js

# output
# PROVIDER: sending temperature
# full power
# RECVD accelerometer: { x: 10, y: 0, z: 0 }
# RECVD status: turned right
# RECVD status: turned left
# RECVD accelerometer: { x: 0, y: 0, z: 0 }
# full power
# PROVIDER: sending temperature
# RECVD temperature: 66.16802112199366
# GETTING STATE
# PROVIDER: sending temperature
# RECVD status: turned left
# full power
# RECVD temperature: 71.20172926224768
# PROVIDER: sending temperature
# PROVIDER completed persistent control
# RECVD temperature: 72.37050646916032
# RECVD status: turned right
```

Now when you run it you should see some more interesting output. You can see that the provider is responding to the controls sent by the consumer. And you can see that the consumer is receiving information generated by the provider. Play around with the values, add controls, event and sensors to get a feel for how everthing works together. For more features see the {@tutorial advanced} tutorial.




