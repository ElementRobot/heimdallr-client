var io = require('socket.io-client');

var Client,
    Provider,
    Consumer;


/**
 * Base class for Heimdallr clients.
 *
 * @constructor
 * @private
 * @arg {string} token - Authentication token, provider or consumer.
 * @return {CLIENT}
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

    /**
     * Add a socket.io event listener. A socket.io event is any message
     * emitted by socket.io client or server and is not to be confused with
     * an {event} which is a special instance of a socket.io event.
     *
     * @arg {string} eventName - Name of the socket.io event to listen for.
     * @arg {eventCallback} fn - Callback to run when socket.io event is heard.
     * @return {CLIENT} The original client object making it chainable.
     */
    Client.prototype.on = function on(eventName, fn){
        if(eventName === 'ready'){
            onReady(this, fn)();
        }
        else {
            // connect and auth-success are protected
            if(eventName !== 'connect' && eventName !== 'auth-success'){
                this.connection.removeListener(eventName);
            }
            this.connection.on(eventName, fn);
        }

        return this;
    };

    /**
     * Callback for socket.io events.
     *
     * @callback {eventCallback}
     * @arg {any} data - Data sent with the event, which may be of any type.
     */

    // Leave this as an undocumented backdoor for ourselves for the time being
    Client.prototype.url = 'https://heimdallr.skyforge.co';

    return Client;
})();


/**
 * Heimdallr provider class.
 *
 * @constructor
 * @arg {string} token - A provider authentication token.
 * @return {PROVIDER}
 */
Provider = (function(){
    function Provider(){
        this.url += '/provider';
        Client.prototype.constructor.apply(this, arguments);

        /**
         * Sends an {event} to the Heimdallr server. The {event} will be
         * saved and then relayed to all subscribed consumers.
         * 
         * @arg {string} name - The {event} name.
         * @arg {json} value - The {event} data.
         */
        this.sendEvent = onReady(this, function sendEvent(name, value){
            var ev = {};
            ev[name] = value;
            this.connection.emit('event', ev);
        });

        /**
         * Sends a {sensor} to the Heimdallr server. The {sensor} will be
         * saved and then relayed to all subscribed consumers.
         * 
         * @arg {string} name - The {sensor} name.
         * @arg {json} value - The {sensor} data.
         */
        this.sendSensor = onReady(this, function sendSensor(name, value){
            var sensor = {};
            sensor[name] = value;
            this.connection.emit('sensor', sensor);
        });

        /**
         * Sends binary data to the Heimdallr server. This should only be
         * used when the Heimdallr server has issued a `{'stream': 'start'}`
         * control packet and should stop when the Heimdallr server has
         * issued a `{'stream': 'stop'} control packet. This data will be
         * relayed to all subscribed consumers who have also joined the
         * stream for this provider. This data will not be saved.
         * 
         * @arg {any} data - The binary data to be sent.
         */
        this.sendStream = onReady(this, function sendStream(data){
            this.connection.emit('stream', data);
        });

        /**
         * Tell Heimdallr server that the persistent {control} with id {uuid}
         * has been completed. A persistent {control} will be sent to a provider
         * when it is first issued, and again on every reconnect until the
         * provider signals that the {control} has been completed.
         *
         * @arg {string} uuid - UUID of the persistent {control} that has been
         *     completed.
         */
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
 * @arg {string} token - A consumer authentication token
 * @return {CONSUMER}
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