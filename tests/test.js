var assert = require('chai').assert,
    PORT = 3000,
    io = require('socket.io').listen(PORT),
    heimdallrClient = require('../index.js'),
    validator = require('heimdallr-validator'),
    validUUID = 'c7528fa8-0a7b-4486-bbdc-460905ffa035';

heimdallrClient.Provider.prototype.url = 'http://localhost:' + PORT;

// Provider section
io.of('/provider').on('connect', function(socket){
    socket.on('authorize', function(packet){
        if(!packet.token){
            socket.emit('err', 'No token provided');
            return;
        }
        packet.token = packet.token.replace('-token', '');
        if(packet.token !== 'wait'){
            socket.emit('auth-success');
        }
    }).on('event', function(packet){
        validator.validatePacket('event', packet);
        socket.emit('heardEvent', packet);
        if(packet.subtype === 'triggerAuthSuccess'){
            socket.emit('auth-success');
        }
        else if(packet.subtype === 'triggerError'){
            socket.emit('err', 'errorTriggered');
        }
        else if(packet.subtype === 'ping'){
            socket.emit('pong');
        }
    }).on('sensor', function(packet){
        validator.validatePacket('sensor', packet);
        socket.emit('heardSensor', packet);
    });
});

io.of('/consumer').on('connect', function(socket){
    function checkConsumerPacket(packet){
        if(!packet){
            socket.emit('err', 'No packet provided');
            return;
        }

        if(!packet.provider){
            socket.emit('err', 'No provider specified');
            return;
        }
        socket.emit('checkedPacket', 'consumer');
    }

    socket.on('authorize', function(packet){
        if(!packet.token){
            socket.emit('err', 'No token provided');
            return;
        }
        packet.token = packet.token.replace('-token', '');
        if(packet.token !== 'wait'){
            socket.emit('auth-success');
        }
    }).on('control', function(packet){
        validator.validatePacket('control', packet);
        socket.emit('heardControl', packet);
        if(packet.subtype === 'triggerAuthSuccess'){
            socket.emit('auth-success');
        }
        else if(packet.subtype === 'triggerError'){
            socket.emit('err', 'errorTriggered');
        }
        else if(packet.subtype === 'ping'){
            socket.emit('pong');
        }
    }).on('setFilter', function(packet){
        checkConsumerPacket(packet);
        if(!packet.filter){
            socket.emit('err', 'No filter provided');
            return;
        }
        socket.emit('checkedPacket', 'setFilter');
    }).on('clearFilter', function(packet){
        checkConsumerPacket(packet);
        if(!packet.packetType){
            socket.emit('err', 'No packetType provided');
            return;
        }
        socket.emit('checkedPacket', 'clearFilter');
    }).on('getState', function(packet){
        checkConsumerPacket(packet);
        if(!packet.subtypes){
            socket.emit('err', 'No subtypes provided');
            return;
        }
        socket.emit('checkedPacket', 'getState');
    });

    // Subsctiption actions
    socket.on('subscribe', checkConsumerPacket)
        .on('unsubscribe', checkConsumerPacket)
        .on('joinStream', checkConsumerPacket)
        .on('leaveStream', checkConsumerPacket);
});

describe('Heimdallr Provider', function(){
    var provider;

    beforeEach(function(done){
        provider = new heimdallrClient.Provider(
            'test-token', {'force new connection': true}
        );
        done();
    });

    it('sends valid event', function(done){
        provider.on('heardEvent', function(){ done(); });
        provider.sendEvent('test', null);
    });

    it('sends valid sensor', function(done){
        provider.on('heardSensor', function(){ done(); });
        provider.sendSensor('test', null);
    });

    it('sends valid completed event', function(done){
        provider.on('heardEvent', function(){ done(); });
        provider.completed('test');
    });

    it('receives errors', function(done){
        console.log('LISTENERS', process.listeners('uncaughtException'))
        var mochaListener = process.listeners('uncaughtException').pop();

        process.removeListener('uncaughtException', mochaListener);
        console.log('POPPED', process.listeners('uncaughtException'))

        function errorListener(error) {
            assert(error.message === 'errorTriggered', error);
            process.removeListener('uncaughtException', errorListener);
            process.on('uncaughtException', mochaListener);
            done();
        }

        process.on('uncaughtException', errorListener);

        console.log('ADDED', process.listeners('uncaughtException'))
        provider.sendEvent('triggerError', null);
    });

    it('waits until ready', function(done){
        var ready = false,
            heardEvent = false,
            heardSensor = false;

        // Have to make a provider that will wait for this test
        provider = new heimdallrClient.Provider('wait-token');
        provider.on('heardEvent', function(){
            // Can't fully trust either
            assert(ready, 'sent event before authorization');
            assert(provider.ready, 'sent event before ready');
            heardEvent = true;
        }).on('heardSensor', function(){
            assert(heardEvent, 'didn\'t hear event first');
            heardSensor = true;
            done();
        }).sendEvent('test', null).sendSensor('test', null);

        // Timing is everything
        setTimeout(function(){
            ready = true;
            provider.connection.emit('authorize', {'token': 'test-token'});
        }, 100);
    });

    it('removes listener', function(done){
        var heardEvent = false,
            count = 0;

        provider.on('heardEvent', function(){
            count++;
            provider.removeListener('heardEvent');
            provider.sendEvent('ping', null);
        }).on('pong', function(){
            assert(count === 1, 'heard the wrong number of events: ' + count);
            done();
        });
        provider.sendEvent('test', null);
    });
});

describe('Heimdallr Consumer', function(){
    var consumer;

    beforeEach(function(done){
        consumer = new heimdallrClient.Consumer(
            'test-token', {'force new connection': true}
        );
        done();
    });

    it('sends valid control', function(done){
        consumer.on('heardControl', function(){ done(); });
        consumer.sendControl(validUUID, 'test', null, true);
    });

    it('sends valid setFilter', function(done){
        consumer.on('checkedPacket', function(message){
            if(message === 'setFilter'){
                done();
            }
        });
        consumer.setFilter(validUUID, {'event': [], 'sensor': []});
    });

    it('sends valid getState', function(done){
        consumer.on('checkedPacket', function(message){
            if(message === 'getState'){
                done();
            }
        });
        consumer.getState(validUUID, []);
    });

    it('can perform subscription actions', function(done){
        var subscriptionActions = [
                'subscribe', 'unsubscribe', 'joinStream', 'leaveStream'
            ],
            count = 0;

        consumer.on('checkedPacket', function(){
            count++;
            if(count === subscriptionActions.length){
                done();
            }
        });
        for(var i = 0; i < subscriptionActions.length; i++){
            consumer[subscriptionActions[i]](validUUID);
        }
    });

    it('receives errors', function(done){
        var mochaListener = process.listeners('uncaughtException').pop();

        process.removeListener('uncaughtException', mochaListener);

        function errorListener(error) {
            assert(error.message === 'errorTriggered', error);
            process.removeListener('uncaughtException', errorListener);
            process.on('uncaughtException', mochaListener);
            done();
        }

        process.on('uncaughtException', errorListener);
        consumer.sendControl(validUUID, 'triggerError', null);
    });

    it('waits until ready', function(done){
        var ready = false,
            heardControl = false;

        // Have to make a consumer that will wait for this test
        consumer = new heimdallrClient.Consumer('wait-token');
        consumer.on('heardControl', function(){
            // Can't fully trust either
            assert(ready, 'sent control before authorization');
            assert(consumer.ready, 'sent control before ready');
            done();
        }).sendControl(validUUID, 'test', null);

        // Timing is everything
        setTimeout(function(){
            ready = true;
            consumer.connection.emit('authorize', {'token': 'test-token'});
        }, 100);
    });

    it('removes listener', function(done){
        var heardControl = false,
            count = 0;

        consumer.on('heardControl', function(){
            count++;
            consumer.removeListener('heardControl');
            consumer.sendControl(validUUID, 'ping', null);
        }).on('pong', function(){
            assert(count === 1, 'heard the wrong number of controls: ' + count);
            done();
        });
        consumer.sendControl(validUUID, 'test', null);
    });

});

