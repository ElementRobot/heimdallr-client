var io = require('socket.io-client');

var Client,
    Provider,
    Consumer;


/**
 * Base class for Heimdallr clients
 * @constructor
 * @private
 * @params {string} token - Authentication token, provider or consumer
 */
Client = (function(){
    function Client(token){
        this.ready = false;
        this.readyCallbacks = [];
        this.handlers = {};

        this.connection = new io.connect(this.url);
        this.connection.on('connect', function(){
            // If they want to authorize right off, let them
            this.connection.emit('authorize', {token: token});
            this.connection.on('auth-success', function callReady(){
                this.readyCallbacks.map(function(fn, i){
                    fn();
                });
                this.readyCallbacks = [];
                this.ready = true;
            }.bind(this));
        }.bind(this));

        this.connection.on('err', function(err){
            throw new Error(err);
        });
    }

    Client.prototype.on = function on(evtName, fn){
        if(evtName === 'ready'){
            onReady(this, fn)();
        }
        else {
            // connect and auth-success are protected
            if(evtName !== 'connect' && evtName !== 'auth-success'){
                this.connection.removeListener(evtName);
            }
            this.connection.on(evtName, fn);
        }

        return this;
    };

    // Leave this as an undocumented backdoor for ourselves for the time being
    Client.prototype.url = 'https://heimdallr.skyforge.co';

    return Client;
})();


/**
 * Heimdallr provider class
 * @constructor
 * @params {string} token - A provider authentication token
 */
Provider = (function(){
    function Provider(){
        this.url += '/provider';
        Client.prototype.constructor.apply(this, arguments);

        this.sendEvent = onReady(this, function sendEvent(name, value){
            var ev = {};
            ev[name] = value;
            this.connection.emit('event', ev);
        });
        this.sendSensor = onReady(this, function sendSensor(name, value){
            var sensor = {};
            sensor[name] = value;
            this.connection.emit('sensor', sensor);
        });
        this.sendStream = onReady(this, function sendStream(data){
            this.connection.emit('stream', data);
        });
        this.completed = onReady(this, function completed(uuid){
            this.connection.emit('event', {'completed': uuid});
        });
    }
    Provider.prototype = Client.prototype;

    return Provider;
})();


/**
 * Heimdallr-Client object
 * @constructor
 * @params {string} token - A consumer authentication token
 */
Consumer = (function(){
    function Consumer(){
        this.url += '/consumer';
        Client.prototype.constructor.apply(this, arguments);

        this.subscribe = onReady(this,function subscribe(uuid){
            this.connection.emit('subscribe', {provider: uuid});
        });
        this.unsubscribe = onReady(this, function unsubscribe(uuid){
            this.connection.emit('unsubscribe', {provider: uuid});
        });
        this.setFilter = onReady(this, function setFilter(uuid, filter){
            filter = filter || {};
            if(!(filter.event instanceof Array) && !(filter.data instanceof Array)){
                throw new Error(
                    'Invalid filter'
                );
            }
            this.connection.emit('setFilter', {provider: uuid, filter: filter});
        });
        this.getState = onReady(this, function getState(uuid, keys){
            this.connection.emit('getState', {provider: uuid, keys: keys});
        });
        this.sendControl = onReady(this, function sendControl(uuid, name, value, persistent){
            var control = {provider: uuid};
            control[name] = value;
            if(persistent){
                control.persistent = true;
            }
            this.connection.emit('control', control);
        });
        this.joinStream = onReady(this, function joinStream(uuid){
            this.connection.emit('joinStream', {provider: uuid});
        });
        this.leaveStream = onReady(this, function leaveStream(uuid){
            this.connection.emit('leaveStream', {provider: uuid});
        });
    }
    Consumer.prototype = Client.prototype;

    return Consumer;
})();

/**
 * Decorator that waits until the socket is ready to do anything
 */
function onReady(obj, fn){
    return function(){
        var args = Array.prototype.slice.call(arguments);
        if(obj.ready){
            fn.apply(obj, args);
        }
        else {
            obj.readyCallbacks.push(function(){
                fn.apply(obj, args);
            });
        }
    };
}

module.exports = {
    Provider: Provider,
    Consumer: Consumer
};