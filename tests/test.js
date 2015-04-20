var PORT = 3000,
    assert = require('chai').assert,
    domain = require('domain').create(),
    Emitter = require('events').EventEmitter,
    io = require('socket.io').listen(PORT),
    heimdallrClient = require('../index.js'),
    validator = require('heimdallr-validator'),
    validUUID = 'c7528fa8-0a7b-4486-bbdc-460905ffa035',
    errorEmitter = new Emitter();

heimdallrClient.Provider.prototype.url = 'http://localhost:' + PORT;

// Provider section
io.of('/provider').on('connect', function(socket){
    socket.on('authorize', function(packet){
        if(!packet.token){
            socket.emit('err', 'No token provided');
            return;
        }
        packet.token = packet.token.replace('-token', '');
        socket.emit('auth-success');
    }).on('event', function(packet){
        var error;

        error = validator.validatePacket('event', packet);
        if(error){
            socket.emit('err', error);
            return;
        }
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
        var error;

        error = validator.validatePacket('sensor', packet);
        if(error){
            socket.emit('err', error);
            return;
        }
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
        socket.emit('auth-success');
    }).on('control', function(packet){
        var error;

        error = validator.validatePacket('control', packet);
        if(error){
            socket.emit('err', error);
            return;
        }
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
        if(!(packet.event instanceof Array) && !(packet.sensor instanceof Array)){
            socket.emit('err', 'Invalid `filter`');
            return;
        }
        socket.emit('checkedPacket', 'setFilter');
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

// We want to wrap everything we do in a domain so we get a first look at
// any uncaught errors
domain.on('error', function(error){
    assert(error.message === 'errorTriggered', error);
    errorEmitter.emit('expectedError');
});

describe('Heimdallr Provider', function(){
    var provider;

    // This isolates our domain to the block of tests. We also exit the domain
    // after the block of tests so as to not conflict with gulp-mocha.
    before(function(){
        domain.enter();
    });

    beforeEach(function(done){
        provider = new heimdallrClient.Provider(
            'valid-token', {'force new connection': true}
        );
        provider.connect();
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
        errorEmitter.once('expectedError', done);
        provider.sendEvent('triggerError', null);
    });

    it('waits until ready', function(done){
        var ready = false,
            heardEvent = false,
            heardSensor = false;

        // Have to make a provider that will wait for this test
        provider = new heimdallrClient.Provider('valid-token');
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
            provider.connect();
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

    after(function(){
        domain.exit();
    });
});

describe('Heimdallr Consumer', function(){
    var consumer;

    before(function(){
        domain.enter();
    });

    beforeEach(function(done){
        consumer = new heimdallrClient.Consumer(
            'valid-token', {'force new connection': true}
        );
        consumer.connect();
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
        errorEmitter.once('expectedError', done);
        consumer.sendControl(validUUID, 'triggerError', null);
    });

    it('waits until ready', function(done){
        var ready = false,
            heardControl = false;

        // Have to make a consumer that will wait for this test
        consumer = new heimdallrClient.Consumer('valid-token');
        consumer.on('heardControl', function(){
            // Can't fully trust either
            assert(ready, 'sent control before authorization');
            assert(consumer.ready, 'sent control before ready');
            done();
        }).sendControl(validUUID, 'test', null);

        // Timing is everything
        setTimeout(function(){
            ready = true;
            consumer.connect();
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

    after(function(){
        domain.exit();
    });
});




