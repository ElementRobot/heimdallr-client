var io = require('socket.io-client');

var Client,
    Provider,
    Consumer;

Client = (function(){
    function Client(url, token){
        this.ready = false;
        this.readyCallbacks = [];
        this.handlers = {};

        this.connection = new io.connect(url);
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

    return Client;
})();

Provider = (function(){
    function Provider(){
        var args = Array.prototype.slice.call(arguments, 0);

        // This is the url
        args[0] += '/provider';

        Client.prototype.constructor.apply(this, args);

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

Consumer = (function(){
    function Consumer(){
        var args = Array.prototype.slice.call(arguments, 0);

        // This is the url
        args[0] += '/consumer';

        Client.prototype.constructor.apply(this, args);
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

// Decorator that waits until the socket is ready to do anything
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