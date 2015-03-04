# Advanced
This tutorial is meant to introduce some of the advanced features of Heimdallr. It builds on the code used in {@tutorial walkthrough}.

## Streaming

First we will make a provider that responds to the streaming controls. The code for that might look something like this

```javascript
function stream(){
    if(!streaming) return;

    var data = new ArrayBuffer(8);
    for(var i = 0; i < data.byteLength; i++){
        data[i] = Math.round(Math.random());
    }
    provider.sendStream(data);
    setTimeout(stream, 10);
}

// Make a new provider
provider = new heimdallrClient.Provider(tokens.provider);
provider.on('err', function(err){
    // Faceplant on error
    throw new Error(err);
}).on('control', function(packet){
    if(packet.subtype === 'stream' && packet.data === 'start'){
        streaming = true;
        stream();
    }
    else if(packet.subtype === 'stream' && packet.data === 'stop'){
        streaming = false;
    }
});
```

Next make consumer to receive the stream

```javascript
// Make a new consumer
consumer = new heimdallrClient.consumer(tokens.consumer);
consumer.on('err', function(err){
    // Faceplant on error
    throw new Error(err);
}).on('auth-success', function(){
    // We've successfully authenticated with the Heimdallr server.
    // Now we can subscribe to providers we want to interact with.
    consumer.subscribe(uuids.provider);
}).on('stream', function(packet){
    // packet also has a provider field that indicates the source
    console.log(packet.stream.toString('base64'));
});

// Want to stream data from this provider
consumer.joinStream(uuids.provider);

setTimeout(function(){
    // Want to stop streaming data from this provider
    consumer.leaveStream(uuids.provider);
}, 3 * 1000);
```

Notice that the consumer does not need to send a stream control. Instead the Heidmallr server takes care of that. The Heimdallr server monitors who is listening to a provider's stream. If a consumer is the first to join a stream for a provider the Heimdallr server will send a stream start packet. If a consumer is the last to leave a stream for a provider the Heimdallr server will send a stream stop packet. The next time a consumer joins the provider's stream it will trigger another stream start packet and so on.

## Filtering
Let's say that the provider is also sending out a bunch of temperature readings that we don't want to hear and some accelerometer readings that we do want to hear. So maybe now our provider code looks like this

```javascript
provider = new heimdallrClient.Provider(tokens.provider);
provider.on('err', function(err){
    // Faceplant on error
    throw new Error(err);
}).on('control', function(packet){
    if(packet.subtype === 'stream' && packet.data === 'start'){
        provider.sendSensor('accelerometer', {x: 0, y: 0, z: 100});
        streaming = true;
        stream();
    }
    else if(packet.subtype === 'stream' && packet.data === 'stop'){
        streaming = false;
    }
});

// Make a fake temperature every second and send the measured value to the Heimdallr server
(function readTemperature(){
    console.log('sending temperature');
    provider.sendSensor('temperature', Math.random() * 40 + 50);
    setTimeout(readTemperature, 1 * 1000);
})();
```

 On the provider side can't just omit the on 'sensor' callback because we still want to hear the accelerometer reading. We could just exit the sensor handler if the subtype is temperature, but that means we are still taking up bandwidth and processing power on the provider (probably not a concern for most use cases but bear with me here). Another option we have is to set the filter for our consumer. So, we could modify our consumer code to look like this

 ```javascript
// Make a new consumer
consumer = new heimdallrClient.consumer(tokens.consumer);
consumer.on('err', function(err){
    // Faceplant on error
    throw new Error(err);
}).on('auth-success', function(){
    // We've successfully authenticated with the Heimdallr server.
    // Now we can subscribe to providers we want to interact with.
    consumer.subscribe(uuids.provider);
    
    // Will only receive accelerometer sensor packets
    // To clear the filter: consumer.setFilter(uuids.provider, {sensor: []});
    consumer.setFilter(uuids.provider, {sensor: ['accelerometer']});
}).on('sensor', function(packet){
    // packet.provider tells us who sent the sensor packet.
    console.log('%s: %s', packet.subtype, packet.data);
}).on('stream', function(packet){
    // packet also has a provider field that indicates the source
    console.log(packet.stream.toString('base64'));
});
```

The setFilter function allows us to select only the packet subtypes that we want to hear. We could do the same for events. Note that even though this consumer is filtering out all but accelerometer packets, the other sensor packets are still being saved on the Heimdallr server and sent out to all the consumers that don't have this filter set.

Now putting it all together we might get a file that looks something like this

```javascript
var heimdallrClient = require('heidmallr-client'),
    tokens = {
        consumer: '7c5ffd18-ed5c-4146-9610-5beabdd9099a',
        provider: 'aac995a3-03f4-4f78-a793-fe7ec8d4f961'
    },
    uuids = {
        consumer: '19d1720c-9796-4ae9-aff3-1f3ed9b1fc3d',
        provider: 'f2af84a5-b361-4875-bf5a-05fa9949facb'
    },
    provider,
    consumer,
    streaming = false;

function stream(){
    if(!streaming) return;

    var data = new ArrayBuffer(8);
    for(var i = 0; i < data.byteLength; i++){
        data[i] = Math.round(Math.random());
    }
    provider.sendStream(data);
    setTimeout(stream, 10);
}

// Make a new provider
provider = new heimdallrClient.Provider(tokens.provider);
provider.on('err', function(err){
    // Faceplant on error
    throw new Error(err);
}).on('control', function(packet){
    if(packet.subtype === 'stream' && packet.data === 'start'){
        provider.sendSensor('accelerometer', {x: 0, y: 0, z: 100});
        streaming = true;
        stream();
    }
    else if(packet.subtype === 'stream' && packet.data === 'stop'){
        streaming = false;
    }
});

// Make a fake temperature every second and send the measured value to the Heimdallr server
(function readTemperature(){
    console.log('sending temperature');
    provider.sendSensor('temperature', Math.random() * 40 + 50);
    setTimeout(readTemperature, 1 * 1000);
})();

// Make a new consumer
consumer = new heimdallrClient.consumer(tokens.consumer);
consumer.on('err', function(err){
    // Faceplant on error
    throw new Error(err);
}).on('auth-success', function(){
    // We've successfully authenticated with the Heimdallr server.
    // Now we can subscribe to providers we want to interact with.
    consumer.subscribe(uuids.provider);
    
    // Will only receive accelerometer sensor packets
    // To clear the filter: consumer.setFilter(uuids.provider, {sensor: []});
    consumer.setFilter(uuids.provider, {sensor: ['accelerometer']});
}).on('sensor', function(packet){
    // packet.provider tells us who sent the sensor packet.
    console.log('%s: %s', packet.subtype, packet.data);
}).on('stream', function(packet){
    // packet also has a provider field that indicates the source
    console.log(packet.stream.toString('base64'));
});

// Want to stream data from this provider
consumer.joinStream(uuids.provider);

setTimeout(function(){
    // Want to stop streaming data from this provider
    consumer.leaveStream(uuids.provider);
}, 3 * 1000);
```