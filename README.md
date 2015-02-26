# heimdallr-client
## Overview
Heimdallr is a system built on top of socket.io for transferring and storing data in real-time. It connects a network of providers to a network of consumers. A provider is a source of data or information. The provider sends that information to the Heimdallr server. The Heimdallr server stores that information and relays it to any consumers that are currently subscribed to that particular provider. If you would like to get started, request an authentication token by emailing (us)[mailto:heimdallr@elementrobot.com]

## Usage
First install (node)[http://nodejs.org/] and (bower)[http://bower.io/] if you don't already have them. Then install heimdallr-client:

```bash
bower install heimdallr-client --save
```

Example usage in Node:

```javascript
var heimdallrClient = require('path/to/bower_components/heimdallr-client/heimdallr-client.js');
```

To use in the browser, `module` must be undefined. Example usage in browser:

```html
<script src="path/to/bower_components/heimdallr-client/heimdallr-client.js"></script>
```

Example provider usage:

```javascript
var provider = new heimdallrClient.Provider('http://heimdallr.skyforge.co', providerAuthToken);

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

Example consumer usage:

```javascript
var consumer = new heimdallrClient.Consumer('http://heimdallr.skyforge.co', consumerAuthToken);

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






