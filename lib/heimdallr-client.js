/** @module heimdallrClient */

var io = require('socket.io-client');

/**
 * A Heimdallr packet is a JSON object. It is how information is
 * transferred between the Heimdallr server and Heimdallr clients. The types
 * of packet are [event]{@link module:heimdallrClient~event},
 * [sensor]{@link module:heimdallrClient~sensor}, and
 * [control]{@link module:heimdallrClient~control}. A Heimdallr packet will
 * always contain <tt>subtype</tt> and <tt>data</tt> fields. It may contain
 * other fields depending on the packet type. Furthermore, some fields may
 * be modified by the Heimdallr server before being relayed to clients.
 * Each packet type has a JSONSchema that the server will validate the packet
 * against. In addition, the packet <tt>data</tt> field will be validated
 * against the associated provider's JSONSchema for the packet subtype.
 *
 * @typedef {} packet
 * @prop {string} subtype - The packet's subtype.
 * @prop {} data - The packet's data.
 */

/**
 * A Heimdallr event packet is a packet that originates from a
 * provider and contains information about the state of the provider. Event 
 * packets are used to transmit discrete, persistent, stateful information 
 * about the provider. For instance a provider may send an event packet with a
 * <tt>'locked'</tt> subtype and data of <tt>'true'</tt>. This locked state will persist in 
 * Heimdallr until the provider sends another event packet with a <tt>'locked'</tt> subtype.
 * <br><br>
 * A consumer can listen for event packets by specifying <tt>msgName</tt>
 * as <tt>'event'</tt> when calling the
 * [on]{@link module:heimdallrClient~Client#on} function. In addition to the
 * standard packet <tt>subtype</tt> and <tt>data</tt> fields, a Heimdallr event
 * packet must have a <tt>t</tt> field. When the Heimdallr server
 * receives an event packet it will add a <tt>provider</tt> field before
 * sending it on to subscribed consumers. All providers have a JSONSchema for
 * the <tt>'completed'</tt> subtype that is used for signaling the
 * completion of a persistent control packet. The event packet
 * <tt>'connected'</tt> subtype is reserved and should not be sent by
 * providers. Instead this event will be emitted by the Heimdallr server
 * on behalf of the provider every time the provider dis/connects. The
 * <tt>data</tt> field for the <tt>'connected'</tt> subtype is a boolean
 * indicating whether or not the provider is connected to Heimdallr.
 * Event packets are graphed as a timeline.
 * 
 * @typedef {} event
 * @prop {string} subtype - The packet's subtype.
 * @prop {} data - The packet's data.
 * @prop {string} t - [ISO 8601]{@link http://en.wikipedia.org/wiki/ISO_8601}
 *     formatted string.
 * @prop {string} provider - UUID of the provider from which it originated.
 */

/**
 * A Heimdallr sensor packet is a packet that originates from a
 * provider and contains information about a measurement made by the provider.
 * Sensor packets are used to transmit samplings of continuous physical data,
 * and unlike event packets, are only considered valid for the time at which
 * the measurement was taken. For instance, a provider may transmit a sensor
 * packet with a subtype <tt>'reactor_temperature_c'</tt>, data <tt>75.03</tt>,
 * and t <tt>'2015-02-28T20:16:12Z'</tt>.
 * <br><br>
 * A consumer can listen for sensor packets by specifying <tt>msgName</tt>
 * as <tt>'sensor'</tt> when calling the
 * [on]{@link module:heimdallrClient~Client#on} function. In addition to the
 * standard packet <tt>subtype</tt> and <tt>data</tt>
 * fields, a Heimdallr sensor packet must have a <tt>t</tt> field.
 * When the Heimdallr server receives a sensor packet it will add a
 * <tt>provider</tt> field before sending it on to subscribed consumers.
 * Sensor packets are graphed as an f(t) plot.
 *
 * @typedef {} sensor
 * @prop {string} subtype - The packet's subtype.
 * @prop {} data - The packet's data.
 * @prop {string} t - [ISO 8601]{@link http://en.wikipedia.org/wiki/ISO_8601}
 *     formatted string.
 * @prop {string} provider - UUID of the provider from which it originated.
 */

/**
 * A Heimdallr control packet is a packet that originates from a consumer
 * and contains information that should be used by the provider. A
 * provider can listen for control packets by specifying <tt>msgName</tt>
 * as <tt>'control'</tt> when calling the
 * [on]{@link module:heimdallrClient~Client#on} function. In addition to the
 * standard packet <tt>subtype</tt> and <tt>data</tt>
 * fields, a Heimdallr control packet must have a <tt>provider</tt>
 * field specifying which provider the control packet should be sent to.
 * If <tt>persistent</tt> is truthy, the Heimdallr server will change the value
 * of the field to a UUID before sending it to the provider. Each time
 * the provider re-connects the control packet will be re-sent until the
 * provider sends an event packet with the subtype
 * <tt>'completed'</tt>. The control packet <tt>'stream'</tt> subtype is
 * reserved and should not be sent by consumers. Instead this control will be
 * sent by the Heimdallr server on behalf of a consumer. The <tt>'stream'</tt>
 * subtype is used to signal that the binary data stream should start or stop.
 *
 * @typedef {} control
 * @prop {string} subtype - The packet's subtype.
 * @prop {} data - The packet's data.
 * @prop {string} provider - UUID of the provider to send the control
 *     packet to.
 * @prop {boolean|string} [persistent] - Whether or not the control
 *     packet should persist. 
 */

/**
 * Callback for socket.io messages.
 *
 * @callback msgCallback
 * @arg {} data - Data sent with the message.
 */


/**
 * The Client constructor takes an authentication token and
 * attempts to connect to the Heimdallr server using the token.
 *
 * @class
 * @classdesc Base class for Heimdallr clients.
 * @private
 * @arg {string} token - Authentication token, provider or consumer.
 * @arg {object} options - socket.io options passed to io.connect.
 * @return {module:heimdallrClient~Client} A new Heimdallr Client object.
 */
function Client(token, options){
    this.ready = false;
    this.readyCallbacks = [];
    this.handlers = {};

    this.connection = new io.connect(this.url, options);
    this.connection.on('connect', function(){
        // If they want to authorize right off, let them
        this.connection.emit('authorize', {'token': token});
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
 * Add a socket.io message listener. A socket.io message is any communication
 * emitted by a socket.io client or server. Heimdallr
 * [packets]{@link module:heimdallrClient~packet} are a special instance
 * of a socket.io message.
 *
 * @method
 * @arg {string} msgName - Name of the socket.io message to listen for.
 * @arg {msgCallback} fn - [Callback]{@link module:heimdallrClient~msgCallback}
 *     to run when socket.io message is heard.
 * @return {module:heimdallrClient~Client}
 */
Client.prototype.on = function on(msgName, fn){
    if(msgName === 'ready'){
        onReady(fn)();
    }
    else {
        this.connection.on(msgName, fn);
    }

    return this;
};

/**
 * Removes a socket.io message listener.
 *
 * @method
 * @arg {string} msgName - Name of the socket.io message to
 *     remove listener for.
 * @return {module:heimdallrClient~Client}
 */
 Client.prototype.removeListener = function removeListener(msgName) {
     this.connection.removeListener(msgName);
     return this;
 };

/**
 * @private
 * @prop {string} url - The URL of the Heimdallr server
 */
// Leave this as an undocumented back door for ourselves for the time being
Client.prototype.url = 'https://heimdallr.skyforge.co';


/**
 * The Provider constructor works in the same way as the Client constructor,
 * but it connects to the /provider namespace.
 *
 * @class
 * @classdesc Heimdallr provider class.
 * @extends {module:heimdallrClient~Client}
 * @arg {string} token - A provider authentication token.
 * @arg {object} options - socket.io options passed to io.connect.
 * @return {module:heimdallrClient~Provider} A new Heimdallr Provider object.
 */
function Provider(){
    this.url += '/provider';
    Client.apply(this, arguments);
}
Provider.prototype = Client.prototype;

/**
 * Sends an event packet to the Heimdallr server. The event
 * will be saved and then relayed to all subscribed consumers.
 * <tt>data</tt> must adhere to the provider's JSONSchema
 * for the given subtype.
 * 
 * @method
 * @arg {string} subtype - The event packet subtype.
 * @arg {json} data - The event packet data.
 * @return {module:heimdallrClient~Provider}
 */
Provider.prototype.sendEvent = onReady(function sendEvent(subtype, data){
    this.connection.emit('event', {
        'subtype': subtype,
        'data': data,
        't': (new Date()).toISOString()
    });
});

/**
 * Sends a sensor packet to the Heimdallr server. The sensor packet will be
 * saved and then relayed to all subscribed consumers. 
 * <tt>data</tt> must adhere to the provider's JSONSchema
 * for the given subtype.
 * 
 * @method
 * @arg {string} subtype - The sensor packet subtype.
 * @arg {json} data - The sensor packet data.
 * @return {module:heimdallrClient~Provider}
 */
Provider.prototype.sendSensor = onReady(function sendSensor(subtype, data){
    this.connection.emit('sensor', {
        'subtype': subtype,
        'data': data,
        't': (new Date()).toISOString()
    });
});

/**
 * Sends binary data to the Heimdallr server. This should only be
 * used when the Heimdallr server has issued a <tt>{'stream': 'start'}</tt>
 * control packet and should stop when the Heimdallr server has
 * issued a <tt>{'stream': 'stop'}</tt> control packet. This data will be
 * relayed to all subscribed consumers who have also joined the
 * stream for this provider. This data will not be saved.
 * 
 * @method
 * @arg {} data - The binary data to be sent.
 * @return {module:heimdallrClient~Provider}
 */
Provider.prototype.sendStream = onReady(function sendStream(data){
    this.connection.emit('stream', data);
});

/**
 * Convenience method for <tt>sendEvent('completed', uuid)</tt>.
 * Tell Heimdallr server that the persistent control packet whose data field is
 * <tt>uuid</tt> has been completed. A persistent control will be sent to a
 * provider when it is first issued, and again on every reconnect
 * until the provider signals that the control has been completed.
 *
 * @method
 * @arg {string} uuid - UUID of the persistent control packet that has been
 *     completed.
 * @return {module:heimdallrClient~Provider}
 */
Provider.prototype.completed = onReady(function completed(uuid){
    this.connection.emit('event', {
        'subtype': 'completed',
        'data': uuid,
        't': (new Date()).toISOString()
    });
});


/**
 * The Consumer constructor works in the same way as the Client constructor,
 * but it connects to the /consumer namespace.
 *
 * @class
 * @classdesc Heimdallr consumer class.
 * @extends {module:heimdallrClient~Client}
 * @arg {string} token - A consumer authentication token.
 * @arg {object} options - socket.io options passed to io.connect.
 * @return {module:heimdallrClient~Consumer} A new Heimdallr Consumer object.
 */
function Consumer(){
    this.url += '/consumer';
    Client.apply(this, arguments);
}
Consumer.prototype = Client.prototype;

/**
 * Subscribe to a provider. A consumer must subscribe to a provider
 * before it receives event or sensor packets from the provider or can
 * send control packets to the provider.
 *
 * @method
 * @arg {string} uuid - UUID of the provider to subscribe to.
 * @return {module:heimdallrClient~Consumer}
 */
Consumer.prototype.subscribe = onReady(function subscribe(uuid){
    this.connection.emit('subscribe', {'provider': uuid});
});

/**
 * Unsubscribe from provider. This will be done automatically 
 * by the Heimdallr server on disconnect.
 * 
 * @method
 * @arg {string} uuid - UUID of the provider to unsubscribe from.
 * @return {module:heimdallrClient~Consumer}
 */
Consumer.prototype.unsubscribe = onReady(function unsubscribe(uuid){
    this.connection.emit('unsubscribe', {'provider': uuid});
});

/**
 * Control which event and sensor packets to listen to. The <tt>filter</tt>
 * object keys should refer to the packet type and the value should be an
 * array of subtypes for the given packet type specified by the key. To clear
 * a filter that you have already set, pass an empty array instead of an array
 * of subtypes.
 *
 * @method
 * @arg {string} uuid - UUID of the provider to filter packets from.
 * @arg {object} filter - Object containing event and sensor packet
 *     subtypes that you want to receive.
 * @return {module:heimdallrClient~Consumer}
 */
Consumer.prototype.setFilter = onReady(function setFilter(uuid, filter){
    filter = filter || {};
    if(!(filter.event instanceof Array) && !(filter.sensor instanceof Array)){
        throw new Error('Invalid `filter`');
    }
    filter.provider = uuid;
    this.connection.emit('setFilter', filter);
});

/**
 * Get the current state of a provider. For each event packet subtype
 * specified, the latest event packet of that subtype will be sent to the
 * consumer by the server.
 * 
 * @method
 * @arg {string} uuid - UUID of the provider to get state for.
 * @arg {array} subtypes - array of event packet subtypes to get.
 * @return {module:heimdallrClient~Consumer}
 */
Consumer.prototype.getState = onReady(function getState(uuid, subtypes){
    if(!(subtypes instanceof Array)){
        throw new Error('`subtypes` must be an array');
    }
    this.connection.emit('getState', {'provider': uuid, 'subtypes': subtypes});
});

/**
 * Send a control packet to a provider. Must adhere to the provider's
 * JSONSchema for the subtype of the control packet.
 * If <tt>persistent</tt> is truthy, a persistent field will be
 * included along with the control packet data.
 * The value of the persistent field will be a new UUID that can be used
 * to signal the Heimdallr server that the control packet has been
 * completed. To do so, the provider must send a <tt>'completed'</tt> event
 * packet with UUID included in the data field. The control packet will be
 * re-sent every time the provider re-connects to Heimdallr until
 * the Heimdallr server has been told that it has been completed.
 *
 * @method
 * @arg {string} uuid - Provider to send the control packet to.
 * @arg {string} subtype - The control packet subtype.
 * @arg {json} data - The control packet data.
 * @arg {boolean} [persistent] - Whether or not the control
 *     should persist.
 * @return {module:heimdallrClient~Consumer}
 */
Consumer.prototype.sendControl = onReady(function sendControl(uuid, subtype, data, persistent){
    var control = {
        'subtype': subtype,
        'data': data,
        'provider': uuid
    };

    if(persistent){
        control.persistent = true;
    }
    this.connection.emit('control', control);
});

/**
 * Join binary data stream from a provider. If this is the first
 * consumer to join the stream from a provider, the Heimdallr server
 * will send a <tt>{"stream": "start"}</tt> control packet to the provider.
 * 
 * @method
 * @arg {string} uuid - UUID of the provider to join stream for.
 * @return {module:heimdallrClient~Consumer}
 */
Consumer.prototype.joinStream = onReady(function joinStream(uuid){
    this.connection.emit('joinStream', {'provider': uuid});
});

/**
 * Leave binary data stream for a provider. If this is the last
 * consumer to leave the stream for a provider the Heimdallr server
 * will send a <tt>{"stream": "stop"}</tt> control packet to the provider. This
 * will be done automatically by the Heimdallr server on disconnect.
 *
 * @method
 * @arg {string} uuid - UUID of the provider to leave stream for.
 * @return {module:heimdallrClient~Consumer}
 */
Consumer.prototype.leaveStream = onReady(function leaveStream(uuid){
    this.connection.emit('leaveStream', {'provider': uuid});
});


/**
 * Decorator that creates a function which will wait until the Client is
 * ready to to call the input <tt>fn</tt>. Any calls to the decorated function
 * will check if the client is ready. If it is ready, it will call
 * the function immediately. If it is not, it will add it to a
 * queue of callbacks that will be called once the Client is ready.
 * The client is ready once it has connected to the Heimdallr
 * server and received an 'auth-success' socket.io message.
 * 
 * @func onReady
 * @private
 * @arg {function} fn - Function to decorate.
 * @return {function} The decorated function that will postpone calls to it
 *     until the client is ready.
 */
function onReady(fn){
    return function(){
        // By assinging `this` to client, we can force this scope to be
        // preserved. Otherwise, if the client isn't ready and the function
        // gets pushed onto `readyCallbacks`, `this` will be the global object
        // when the `readyCallbacks` are finally called.
        var client = this,
            args = Array.prototype.slice.call(arguments);
        if(client.ready){
            fn.apply(client, args);
        }
        else {
            client.readyCallbacks.push(function(){
                fn.apply(client, args);
            });
        }
        return client;
    };
}

module.exports = {
    Provider: Provider,
    Consumer: Consumer
};
