## Overview
Heimdallr is a system built on top of socket.io for transferring and storing data in real-time. It connects a network of providers to a network of consumers. A provider is a source of data. The provider sends that data to the Heimdallr server, which then stores it and relays it to any consumers that are currently subscribed to that particular provider. If you would like to get started, request an authentication token by emailing [us](mailto:heimdallr@elementrobot.com).

## Usage
### In the browser
First install [bower](http://bower.io/) if you don't already have it. Then grab the package using bower:

```bash
bower install heimdallr-client --save
```

Then include a script tag with your HTML:

```html
<script src="/path/to/bower_components/heimdallr-client/build/heimdallr-client.min.js"></script>
```

### In node
Install [node](http://nodejs.org/) if you don't have it. Then grab the package using npm:

```bash
npm install heimdallr-client -g
```

The `-g` flag is optional but it gives you easy access to the post-schemas utility (see [Set Subtype Schemas](#set-subtype-schemas)). Then you just need to use require to include the module in your script:

```javascript
var heimdallrClient = require('heimdallr-client');
```

## Examples
### Set Subtype Schemas
For the examples below we would need to define the different event, sensor, and control packet subtypes that we want to use with [JSON schemas](http://json-schema.org/). The Heimdallr server uses these schemas to validate the packets that it receives as well as make intelligent visualizations of your data. So we might have a file called `packet-schemas.json` that contains:

```json
{
    "event": {
        "yourEventSubtype": {
            "type": "object",
            "properties": {
                "arbitrary": {"type": "string"}
            }
        }
    },
    "sensor": {
        "yourSensorSubtype": {"type": "number"},
        "otherSensorSubtypeX": {
            "type": "object",
            "properties": {
                "everyone": {"type": "string"},
                "notRequired": {"type": "array"}
            },
            "required": ["everyone"]
        }
    },
    "control": {
        "yourControlSubtype": {
            "type": "object",
            "properties": {
                "yourControl": {"type": "string"}
            }
        }
    }
}
```

If you installed heimdallr-client with npm using the -g option then from the command line you can do:

```bash
post-schemas <consumerAuthToken> -u <uuidOfProvider> -f packet-schemas.json
```

Otherwise you'll need to do:

```bash
node /path/to/heimdallr-client/bin/post-schemas <consumerAuthToken> -u <uuidOfProvider> -f packet-schemas.json
```

If you installed with npm then `/path/to/heimdallr-client` should probably be something like `./node_modules/heimdallr-client` or if you installed with bower `./bower_components/heimdallr-client`. Multiple provider UUIDs or .json files can be specified by using the -u or -f flags multiple times. Again this assumes you have node installed. If you don't have node installed you will need to make the HTTP POSTs on your own. The curl alternative might look something like:

```bash
curl -H "Content-Type: application/json" -H "Authorization: Token <consumerAuthToken>" -X POST -d '{"packetType": "event", "subtypeSchemas": {"youSensorSubtype": {}, ...' https://heimdallr.co/api/v1/provider/<uuidOfProvider>/subtype-schemas
```

### Provider
```javascript
var provider = new heimdallrClient.Provider(providerAuthToken);

// Respond to controls from consumers
provider.on('auth-success', function(){
    // You are now connected to Heimdallr
}).on('err', function(data){
    // data contains information about the error you just recieved
}).on('control', function(data){
    // Respond to the control data a consumer sent you
});

// Broadcast event data 
provider.sendEvent('yourEventSubtype', {arbitrary: 'data'});

// Broadcast sensor data
provider.sendSensor('yourSensorSubtype', 72);
provider.sendSensor('otherSensorSubtypeX', {everyone: '\u2665s json'});

// Broadcast binary data
provider.sendStream(new Uint8Array());

// Signal server that a persistent control has been finished
provider.completed(uuidOfControl);
```

### Consumer
```javascript
var consumer = new heimdallrClient.Consumer(consumerAuthToken);

consumer.on('auth-success', function(){
    // You are now connected to Heimdallr
}).on('sensor', function(data){
    // Incoming sensor data
}).on('event', function(data){
    // Incoming event data
}).on('stream', function(data){
    var bytes = new Uint8Array(data);
});

// Start listening to a particular provider
consumer.subscribe(uuidOfProvider);

// Stop listening to a particular annoying provider
consumer.unsubscribe(uuidOfProvider);

// Specify what you actually want to hear
consumer.setFilter(uuidOfProvider, {'event': ['Subtypes I', 'want'], 'sensor': ['to', 'receive']});

// Get the latest events emitted by a provider
consumer.getState(uuidOfProvider, ['arrayOf', 'subtypeNames']);

// Boss a provider around
consumer.sendControl(uuidOfProvider, 'yourControlSubtype', {'yourControl': 'data'});

// Tell a provider to start streaming and start listening
consumer.joinStream(uuidOfProvider);

// Tell a provider to stop streaming and stop listening
consumer.leaveStream(uuidOfProvider);
```






