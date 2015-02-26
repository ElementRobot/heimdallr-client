# Heimdallr-Client
## Overview
Heimdallr is a system built on top of socket.io for transferring and storing data in real-time. It connects a network of providers to a network of consumers. A provider is a source of data or information. The provider sends that information to the Heimdallr server. The Heimdallr server stores that information and relays it to any consumers that are currently subscribed to that particular provider. If you would like to get started, request an authentication token by emailing [us](mailto:heimdallr@elementrobot.com)

## Usage
### In the browser
First install [bower](http://bower.io/) if you don't already have it. Then grab the package using bower:

```bash
bower install heimdallr-client --save
```

Then include a script tag with your HTML:

```html
<script src="path/to/bower_components/heimdallr-client/build/heimdallr-client.min.js"></script>
```

### In node
Install [node](http://nodejs.org/) if you don't have it. Then grab the package using npm:

```bash
npm install heimdallr-client --save
```

Then you just need to use require to include the module in your script:

```javascript
var heimdallrClient = require('heimdallr-client');
```

## Examples
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

// Broadcast sensor data
provider.sendSensor('yourSensorName', 72);
provider.sendSensor('otherSensor', {everyone: '\u2665s json'});

// Broadcast event data 
provider.sendEvent('youGetIt', {arbitrary: 'data'});

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
    // Incoming binary data will be in 
});
```






