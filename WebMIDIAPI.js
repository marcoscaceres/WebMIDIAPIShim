/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, browser:true, indent:4, maxerr:50 */
/*
 * performance.now()
 * Polyfill of: http://www.w3.org/TR/hr-time/
 *
 * Copyright (c) 2012 Marcos Caceres
 * Licensed under the MIT license.
 */ 
 (function (exports) {
    'use strict';
    var perf = {};
    //if already defined, bail
    if (('performance' in exports) && ('now' in exports.performance)) {
        return;
    }

    function findNowMethod() {
        var prefix = 'moz,webkit,opera,ms'.split(','),
            i = prefix.length,
            //worst case, we use Date.now()
            props = {
                value: timecall(Date.now())
            };

        function timecall(start) {
            return function () {
                return Date.now() - start;
            };
        }

        function methodCall(method) {
            return function () {
                return exports.performance[method]();
            };
        }

        //seach for vendor prefixed version
        for (var method; i >= 0; i--) {
            if ((prefix[i] + 'Now') in exports.performance) {
                method = prefix[i] + 'Now';
                props.value = methodCall(method);
                return props;
            }
        }

        //otherwise, try to use connectionStart
        if ('timing' in exports.performance &&
            'connectStart' in exports.performance.timing) {
            //this pretty much approximates performance.now() to the millisecond
            props.value = timecall(exports.performance.timing.connectStart);
        }
        return props;
    }

    //If we have no 'performance' at all, create it
    if (!('performance' in exports)) {
        Object.defineProperty(exports, 'performance', {
            get: function () {
                return perf;
            }
        });
    }
    Object.defineProperty(exports.performance, 'now', findNowMethod());
}(typeof exports === 'object' && exports || this));


/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, browser:true, indent:4, maxerr:50 */
/*
 * Web MIDI API - Prollyfill
 * https://dvcs.w3.org/hg/audio/raw-file/tip/midi/specification.html
 *
 * Copyright (c) 2012 Marcos Caceres
 * Licensed under the MIT license.
 */ (function (global, exports, perf) {
    'use strict';
    var midiIO = null,
        debug = true;

    if (debug) {
        window.console.warn('Debuggin enabled');
    }

    function requestMIDIAccess(successCallback, errorCallback) {
        function accessGranted(accessor) {
            successCallback(accessor);
        }

        //WebIDL 4.2.21. Callback function types
        if (typeof successCallback !== 'function') {
            throw new TypeError();
        }
        if (errorCallback && typeof errorCallback !== 'function') {
            throw new TypeError();
        }

        if (midiIO === null) {
            setTimeout(function () {
                midiIO = new JazzPlugin();
                midiIO.requestAccess(accessGranted, errorCallback);
            }, 0);
        }

    }
    if ('requestMIDIAccess' in exports) {
        return; // namespace is taken already, bail!
    }
    Object.defineProperty(exports, 'requestMIDIAccess', {
        value: requestMIDIAccess
    });

    /*
    creates instances of the Jazz plugin (http://jazz-soft.net/)
    The plugin exposes the following methods (v1.2):
    MidiInClose()
    MidiInList()
    MidiInOpen()
    MidiOut()
    MidiOutClose()
    MidiOutList()
    MidiOutLong()
    MidiOutOpen()
    Support()
    Time()
    version
    See also: http://jazz-soft.net/doc/Jazz-Plugin/reference.html
    */
    function JazzPlugin() {
        var dispatcher = document.createElement('x-eventDispatcher'),
            plugin = loadPlugin(),
            permitted = null,
            inputPorts = [],
            outputPorts = [],
            interfaces = {
                time: {
                    get: function () {
                        return plugin.Time();
                    }
                },
                requestAccess: {
                    value: checkPermission
                },
                midiInList: {
                    get: function () {
                        return inputPorts;
                    }
                },
                midiOutList: {
                    get: function () {
                        return outputPorts;
                    }
                },
                midiInOpen: {
                    value: function (name, callback) {
                        //TODO: check if authorized
                        plugin.MidiInOpen(name, callback);
                    }
                },
                midiOutLong: {
                    value: function (data, name) {
                        if (plugin.MidiOutOpen(name) === name) {
                            plugin.MidiOutLong(data);
                        }
                    }
                }
            };

        function createPorts(list, type) {
            var ports = [];
            for (var i = 0, name = '', l = list.length; i < l; i++) {
                name = String(list[i]);
                ports[i] = new MIDIPort(name, type);
            }
            return ports;
        }

        function checkPermission(successCB, errorCB) {
            //going to ask permission for the first time
            if (permitted === null) {
                requestPermission(plugin);
                dispatcher.addEventListener('allowed', function () {
                    successCB(new MIDIAccess());
                });
                if (errorCB && typeof errorCB === 'function') {
                    dispatcher.addEventListener('denied', function (e) {
                        errorCB(new Error(e.data));
                    });
                }
                return;
            }
            if (permitted === true) {
                successCB(new MIDIAccess());
                return;
            }
            errorCB(new Error('SecurityError'));
        }
        //loads the Jazz plugin by creating an <object>
        function loadPlugin() {
            var elemId = '_Jazz' + Math.random(),
                objElem = document.createElement('object');
            objElem.id = elemId;
            objElem.type = 'audio/x-jazz';
            document.documentElement.appendChild(objElem);
            if (!(objElem.isJazz)) {
                var e = new window.CustomEvent('error');
                e.data = new Error('NotSupportedError');
                dispatcher.dispatchEvent(e);
                return null;
            }
            //Initialize
            objElem.MidiOut(0x80, 0, 0);
            return objElem;
        }

        function requestPermission(plugin) {
            var div = document.createElement('div'),
                style = document.createElement('style'),
                okButton = document.createElement('button'),
                cancelButton = document.createElement('button'),
                id = 'dialog_' + (Math.round(Math.random() * 1000000) + 10000),
                markup = '',
                css = '';
            if (!(plugin)) {
                throw 'Jazz plugin was not Initialized. Did you install it?';
            }
            css += '#' + id + '{ ' + 'width: 60%; ' + 'box-shadow: 0px 2px 20px black; z-index: 1000;' + ' left: 20%; background-color: #aaa;' + ' padding: 3em;' + '} ' + '.hidden{ top: -' + Math.round(window.innerHeight) + 'px; -webkit-transition: all .2s ease-in;}' + '.show{top: 0px; -webkit-transition: all .2s ease-out;}';
            style.innerHTML = css;
            div.id = id;
            markup += '<div>' + '<h1>♫ MIDI ♫</h1>' + '<p>' + window.location.host + ' wants to access your MIDI devices.</p>' + '<p><strong>Input Devices:</strong> ' + plugin.MidiInList().join(', ') + '.</p>' + '<p><strong>Output Devices:</strong> ' + plugin.MidiOutList().join(', ') + '.</p>' + '</div>';
            okButton.innerHTML = 'Allow';
            okButton.onclick = function () {
                var e = new window.CustomEvent('allowed');
                div.className = 'hidden';
                permitted = true;
                e.data = {
                    inputPorts: plugin.MidiInList(),
                    outputPorts: plugin.MidiOutList()
                };
                dispatcher.dispatchEvent(e);
            };
            cancelButton.innerHTML = 'Cancel';
            cancelButton.onclick = function () {
                var e = new window.CustomEvent('denied');
                e.data = 'SecurityError';
                dispatcher.dispatchEvent(e);
                div.className = 'hidden';
                permitted = false;
            };
            div.innerHTML = markup;
            div.appendChild(okButton);
            div.appendChild(cancelButton);
            div.className = 'hidden';
            document.body.appendChild(div);
            document.head.appendChild(style);
            div.style.position = 'fixed';
            setTimeout(function () {
                div.className = 'show';
            }, 100);
            if (debug) {
                setTimeout(function () {
                    okButton.click();
                }, 500);
            }
        }
        /*
        [Constructor(DOMString type, optional MIDIMessageEventInit eventInitDict)]
        interface MIDIEvent : Event {
            readonly attribute DOMHighResTimeStamp receivedTime;
            readonly attribute Uint8Array          data;
            readonly attribute MIDIPort            port;
        };
        dictionary MIDIMessageEventInit : EventInit {
          any data;
          MIDIPort port;
        };
        */

        //Define the interface in conformance to 4.4 of WebIDL

        function implementMIDIEvent() {
            var interfaceProtoObj,
            interfaceObj,
            protoProps = null;
            /*
            There must exist an interface prototype object for every non-callback interface defined, 
            regardless of whether the interface was declared with the [NoInterfaceObject] 
            extended attribute. The interface prototype object for a particular 
            interface has properties that correspond to the regular attributes and regular 
            operations defined on that interface. 
            These properties are described in more detail in sections 4.4.6 and 4.4.7 below.
            */
            interfaceProtoObj = function MIDIEvent() {};

            /*
            For every interface ... a corresponding property must exist on 
            the ECMAScript global object. 
            The name of the property is the identifier of the interface, 
            and its value is an object called the interface object.
            */
            interfaceObj = function MIDIEvent() {
                if (!(this instanceof MIDIEvent)) {
                    throw new TypeError("DOM object constructor cannot be called as a function.")
                }
            }

            //The property has the attributes { [[Writable]]: true, [[Enumerable]]: false, [[Configurable]]: true }.
            //The characteristics of an interface object are described in section 4.4.1 below.
            Object.defineProperty(global, "MIDIEvent", {
                writable: true,
                enumerable: false,
                configurable: true,
                value: interfaceObj
            })

            /*
            The value of the “prototype” property of an interface object for a non-callback interface 
            must be an object called the interface prototype object. 
            This object has properties that correspond to the regular attributes and regular operations defined on the interface, 
            and is described in more detail in section 4.4.3 below.
            */
            Object.defineProperty(interfaceObj, "prototype", {
                writable: false,
                enumerable: false,
                configurable: false,
                value: new interfaceProtoObj()
            });

            //If the [NoInterfaceObject] extended attribute was not specified on the interface, 
            //then the interface prototype object must also have a property named “constructor”
            //with attributes { [[Writable]]: true, [[Enumerable]]: false, [[Configurable]]: true } 
            //whose value is a reference to the interface object for the interface.
            Object.defineProperty(interfaceProtoObj, "constructor", {
                writable: true,
                enumerable: false,
                configurable: true,
                value: interfaceObj
            })
        }
        implementMIDIEvent();

        function MIDIEvent(data, port) {
            var receivedTime = perf.now(),
                interfaces = {
                    receivedTime: {
                        get: function () {
                            return receivedTime;
                        }
                    },
                    data: {
                        get: function () {
                            return data;
                        }
                    },
                    port: {
                        get: function () {
                            return port;
                        }
                    },
                    currentTarget: {
                        get: function () {
                            return;
                        }
                    },
                    target: {
                        get: function () {
                            return;
                        }
                    },
                    srcElement: {
                        get: function () {
                            return;
                        }
                    }
                },
                e = new window.CustomEvent('message', {
                    detail: this
                });
            Object.defineProperties(this, interfaces);
            return e;
        }
        MIDIEvent.prototype = Object.create(Event.prototype);

        /*
        interface MIDIOutput : MIDIPort {
            void send (sequence<short> data, optional DOMHighResTimeStamp? timestamp);
        };
        */

        function MIDIOutput{
            MIDIPort.call(this);
        }
        MIDIOutput.prototype = Object.create(MIDIPort.prototype);

        /*
        interface MIDIPort : EventListener {
            readonly attribute DOMString    id;
            readonly attribute DOMString?   manufacturer;
            readonly attribute DOMString?   name;
            readonly attribute MIDIPortType type;
            readonly attribute DOMString?   version;
                     attribute EventHandler? onmessage;
            serializer = {id, manufacturer, name, type, version};
        }
        */
        function MIDIPort(name, type) {
            var self = this,
                dispatcher = (type === 'input') ? document.createElement('x-eventDispatcher') : null,
                id = hash(name),
                deviceName = String(name),
                manufacturer = null,
                version = null,
                eventHandler = null,
                messageCallback = (type === 'input') ? function (timestamp, data) {
                    var e = new MIDIEvent(new Uint8Array(data), self);
                    dispatcher.dispatchEvent(e);
                } : null,
                interfaces = {
                    id: {
                        get: function () {
                            return id;
                        }
                    },
                    type: {
                        get: function () {
                            return type;
                        }
                    },
                    version: {
                        get: function () {
                            return version;
                        }
                    },
                    name: {
                        get: function () {
                            return deviceName;
                        }
                    },
                    //EventListener - can't extend type so need to implement:(
                    addEventListener: {
                        value: function (type, listener, useCapture) {
                            dispatcher.addEventListener(type, function (e) {
                                listener.call(self, e.detail);
                            }, useCapture);
                        }
                    },
                    removeEventListener: {
                        value: function (type, listener, useCapture) {
                            dispatcher.removeEventListener(type, listener, useCapture);
                        }
                    },
                    dispatchEvent: {
                        value: function (evt) {
                            dispatcher.dispatchEvent(evt);
                        }
                    },
                    onmessage: {
                        set: function (aFunction) {
                            //clear prevously set event handler
                            if (eventHandler !== null) {
                                dispatcher.removeEventListener('message', eventHandler, false);
                                eventHandler = null;
                            }
                            //check if callable
                            if (aFunction.call && typeof aFunction.call === 'function') {
                                this.addEventListener('message', aFunction, false);
                                eventHandler = aFunction;
                            }
                            return eventHandler;
                        },
                        get: function () {
                            return eventHandler;
                        },
                        enumerable: false,
                        configurable: false
                    },
                    send: {
                        value: function (data, timestamp) {
                            if (!(data instanceof Uint8Array)) {
                                data = new Uint8Array(data);
                            }
                            if ((typeof timestamp) !== "undefined") {
                                //WebIDl double checks (4.2.14. double)
                                //1. Let x be ToNumber(V).
                                timestamp = Number(timestamp);
                                //2. If x is NaN, +Infinity or −Infinity, then throw a TypeError.
                                if (isNaN(timestamp) || timestamp === +Infinity || timestamp === -Infinity) {
                                    throw new TypeError();
                                }
                            }
                            return send(self, data, timestamp);
                        }
                    },
                    //non standard
                    toJSON: {
                        value: function toJSON() {
                            var info = {
                                type: type,
                                name: name,
                                manufacturer: manufacturer,
                                version: version,
                                id: id
                            };
                            return JSON.stringify(info);
                        }
                    }
                };
            //djb2 hashing function
            //http://erlycoder.com/49/javascript-hash-functions-to-convert-string-into-integer-hash-
            function hash(str) {
                var result = 5381;
                for (var char, i = 0, l = str.length; i < l; i++) {
                    char = str.charCodeAt(i);
                    result = ((result << 5) + result) + char;
                }
                return String(result);
            }

            function send(port, data, timestamp) {
                var delay;
                if (port.type === 'input' || data.length === 0) {
                    return false;
                }
                delay = (timestamp) ? Math.floor(timestamp - window.performance.now()) : 0;

                if (delay > 0) {
                    window.setTimeout(function () {
                        send(port, data);
                    }, delay);
                } else {
                    midiIO.midiOutLong(data, self.name);
                }
                return true;
            }
            Object.defineProperties(this, interfaces);
            if (type === 'input') {
                midiIO.midiInOpen(name, messageCallback);
            }
        }
        /*
        interface MIDIAccess {
            sequence<MIDIPort> getInputs();
            sequence<MIDIPort> getOutputs();
            MIDIPort           getPortById(DOMString id);
        };
        */
        function MIDIAccess() {
            var interfaces = {
                getInputs: {
                    value: function () {
                        return midiIO.midiInList.slice(0);
                    }
                },
                getOutputs: {
                    value: function () {
                        return midiIO.midiOutList.slice(0);
                    }
                },
                getPortById: {
                    value: function (id) {
                        var ports = this.getInputs().concat(this.getOutputs);
                        id = String(id);
                        for (var i = 0, l = ports.length; i < l; i++) {
                            if (ports[i].id === id) {
                                return ports[i];
                            }
                        }
                        return null;
                    }
                }
            };
            Object.defineProperties(this, interfaces);
        }

        //once we are allowed, lets get the ports list
        dispatcher.addEventListener('allowed', function (e) {
            inputPorts = createPorts(e.data.inputPorts, 'input');
            outputPorts = createPorts(e.data.outputPorts, 'output');
        });
        Object.defineProperties(this, interfaces);
    }
}(window, window.navigator, window.performance));
