/*jshint proto:false, devel:true, forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, browser:true, indent:4, maxerr:50 */
/**
 * Web MIDI API - Prollyfill
 * https://dvcs.w3.org/hg/audio/raw-file/tip/midi/specification.html
 *
 * Copyright (c) 2012 Marcos Caceres
 * Licensed under the MIT license.
 **/
(function (window, navigator, perf) {
    'use strict';
    var midi = {io: null},
        debug = true,
        //constructors will hold the real object constructors
        constructors = {};
    if ('requestMIDIAccess' in navigator) {
        console.warn("requestMIDIAccess already defined in navigator, aborting.");
        return;
    }

    if (debug) {
        console.warn('Debuggin enabled');
    }


    /*
    partial interface Navigator {
        void requestMIDIAccess (SuccessCallback successCallback, optional ErrorCallback errorCallback);
    };
    */
    (function implementRequestMIDIAccess(navigator) {
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
            if (midi.io === null) {
                setTimeout(function () {
                    midi.io = new JazzPlugin();
                    midi.io.requestAccess(accessGranted, errorCallback);
                }, 0);
            }

        }
        Object.defineProperty(navigator, 'requestMIDIAccess', {
            value: requestMIDIAccess
        });
    }(navigator));
    /*
    interface MIDIPort {
        readonly attribute DOMString    id;
        readonly attribute DOMString?   manufacturer;
        readonly attribute DOMString?   name;
        readonly attribute MIDIPortType type;
        readonly attribute DOMString?   version;
        serializer = {id, manufacturer, name, type, version};
    }
    */
    (function implementMIDIPort(exports) {
        //djb2 hashing function - for testing, not in spec
        //http://erlycoder.com/49/javascript-hash-functions-to-convert-string-into-integer-hash-
        function hash(str) {
            var result = 5381;
            for (var char, i = 0, l = str.length; i < l; i++) {
                char = str.charCodeAt(i);
                result = ((result << 5) + result) + char;
            }
            return String(result);
        }
        function MIDIPort(name, type, version, manufacturer) {
            var id = hash(String(name) + type),
                attributes = {
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
                            return name;
                        }
                    }
                };
            //MIDIPortType are "input" and "output"
            if (type !== 'input' && type !== "output") {
                throw new TypeError("type argument did not match a valid MIDIPortType");
            }
            //stringify if supplied, nullify if not supplied as per WebIDL
            name = (name) ? String(name) : null;
            manufacturer = (manufacturer) ? String(manufacturer) : null;
            version = (version) ? String(version) : null;
            Object.defineProperties(this, attributes);
        }
        MIDIPort.prototype.constructor = MIDIPort;
        MIDIPort.prototype.toJSON = function toJSON() {
            if (!(this instanceof MIDIPort)) {
                throw new TypeError('Illegal invocation');
            }
            var info = {
                type: this.type,
                name: this.name,
                manufacturer: this.manufacturer,
                version: this.version,
                id: this.id
            };
            return JSON.stringify(info);
        };
        exportInterfaceObject(MIDIPort);
        exports.MIDIPort = MIDIPort;
    }(constructors));

    /*
    [Constructor(DOMString type, optional MIDIMessageEventInit eventInitDict)]
    interface MIDIEvent : Event {
        readonly attribute double      receivedTime;
        readonly attribute Uint8Array  data;
        readonly attribute MIDIPort    port;
    };
    dictionary MIDIMessageEventInit : EventInit {
      any data;
      MIDIPort port;
    };
    */
    (function implementMIDIEvent(exports) {
        function MIDIEvent(type, dict) {
            var receivedTime = perf.now(),
                //we exploit the detail object to get the real event later
                attributes = {
                    receivedTime: {
                        get: function () {
                            return receivedTime;
                        }
                    },
                    data: {
                        get: function () {
                            return dict.data;
                        }
                    },
                    port: {
                        get: function () {
                            return dict.port;
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
                };
            this.__proto__ = new window.Event(type);
            Object.defineProperties(this, attributes);
            return new window.CustomEvent(type, {detail: this});
        }
        MIDIEvent.prototype = Object.create(window.Event.prototype);
        MIDIEvent.prototype.constructor = MIDIEvent;
        exportInterfaceObject(MIDIEvent);
        exports.MIDIEvent = MIDIEvent;
    }(constructors));
    
    /*
    interface MIDIOutput : MIDIPort {
        void send (sequence<octet> data, optional double? timestamp);
    };
    */
    (function implementMIDIOutput(window, exports, MIDIPort, midi) {
        //Set up prototype interface object and inheritance chain
        function MIDIOutput(name) {
            MIDIPort.call(this, name, 'output');
        }
        function sendToMidi(port, data, timestamp) {
            var delay;
            if (data.length === 0) {
                return false;
            }
            delay = (timestamp) ? Math.floor(timestamp - window.performance.now()) : 0;
            if (delay > 0) {
                window.setTimeout(function () {
                    sendToMidi(port, data);
                }, delay);
            } else {
                midi.io.midiOutLong(data, port.name);
            }
            return true;
        }
        MIDIOutput.prototype = Object.create(MIDIPort.prototype);
        MIDIOutput.prototype.constructor = MIDIOutput;

        //void send (any data, optional double? timestamp);
        MIDIOutput.prototype.send = function send(data, timestamp) {
            //Check that no one has stolen the method
            if (!(this instanceof MIDIOutput)) {
                throw new TypeError('Illegal invocation');
            }

            //TODO: check sequence<octet> data
            if (!(data instanceof Uint8Array)) {
                data = new Uint8Array(data);
            }

            //optional double? timestamp
            if ((typeof timestamp) !== 'undefined') {
                //WebIDl double checks (4.2.14. double)
                //1. Let x be ToNumber(V).
                timestamp = Number(timestamp);
                //2. If x is NaN, +Infinity or −Infinity, then throw a TypeError.
                if (isNaN(timestamp) || timestamp === +Infinity || timestamp === -Infinity) {
                    throw new TypeError();
                }
            }
            return sendToMidi(this, data, timestamp);
        };
        exportInterfaceObject(MIDIOutput);
        exports.MIDIOutput = MIDIOutput;
    }(window, constructors, constructors.MIDIPort, midi));
    /*
    interface MIDIInput : MIDIPort {
        attribute EventHandler onmessage;
    };
    MIDIInput implements EventTarget;
    */
    (function implementMIDIInput(exports, MIDIEvent, MIDIPort) {
        function checkAccess(object) {
            //Check that no one has stolen the method
            if (!(object instanceof MIDIAccess)) {
                throw new TypeError('Illegal invocation');
            }
        }
        function MIDIInput(name) {
            MIDIPort.call(this, name, 'input');
            var dispatcher = document.createElement('x-eventDispatcher'),
                self = this,
                eventHandler = null,
                attributes = {
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
                    //Unfortunately, there is no other way to share this, AFAIK
                    dispatcher: {
                        get: function () {
                            return dispatcher;
                        }
                    }
                };

            function messageCallback(timestamp, data) {
                var e = new MIDIEvent('message', {
                    data: new Uint8Array(data),
                    port: self
                });
                self.dispatcher.dispatchEvent(e);
            }
            Object.defineProperties(this, attributes);
            //Listen for messages
            midi.io.midiInOpen(name, messageCallback);
        }
        MIDIInput.prototype = Object.create(MIDIPort.prototype);
        MIDIInput.prototype.constructor = MIDIInput;
        
        //implement EventTarget
        MIDIInput.prototype.addEventListener = function (type, listener, useCapture) {
            checkAccess(this);
            this.dispatcher.addEventListener(type, function (e) {
                    listener.call(this, e.detail);
                }, useCapture);
        };
                
        MIDIInput.prototype.removeEventListener = function (type, listener, useCapture) {
            checkAccess(this);
            this.dispatcher.removeEventListener(type, listener, useCapture);
        };
                
        MIDIInput.prototype.dispatchEvent = function (evt) {
            checkAccess(this);
            this.dispatcher.dispatchEvent(evt);
        };
        exportInterfaceObject(MIDIInput);
        exports.MIDIInput = MIDIInput;
    }(constructors, constructors.MIDIEvent, constructors.MIDIPort));

    /*
    interface MIDIAccess {
        sequence<MIDIPort> getInputs();
        sequence<MIDIPort> getOutputs();
        MIDIPort           getPortById(DOMString id);
    };
    */
    (function implementMIDIAccess(exports, midi) {
        function MIDIAccess() {}

        function checkAccess(object) {
            //Check that no one has stolen the method
            if (!(object instanceof MIDIAccess)) {
                throw new TypeError('Illegal invocation');
            }
        }

        MIDIAccess.prototype.getInputs = function () {
            checkAccess(this);
            return midi.io.midiInList.slice(0);
        };
        
        MIDIAccess.prototype.getOutputs = function () {
            checkAccess(this);
            return midi.io.midiOutList.slice(0);
        };

        MIDIAccess.prototype.getPortById = function (id) {
            var ports;
            checkAccess(this);
            ports = this.getInputs().concat(this.getOutputs);
            id = String(id);
            for (var i = 0, l = ports.length; i < l; i++) {
                if (ports[i].id === id) {
                    return ports[i];
                }
            }
            return null;
        };
        exportInterfaceObject(MIDIAccess);
        exports.MIDIAccess = MIDIAccess;
    }(constructors, midi));

   

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
                ports[i] = (type === 'input') ? new constructors.MIDIInput(name) : new constructors.MIDIOutput(name);
            }
            return ports;
        }

        function checkPermission(successCB, errorCB) {
            //going to ask permission for the first time
            if (permitted === null) {
                requestPermission(plugin);
                dispatcher.addEventListener('allowed', function () {
                    successCB(new constructors.MIDIAccess());
                });
                if (errorCB && typeof errorCB === 'function') {
                    dispatcher.addEventListener('denied', function (e) {
                        errorCB(new Error(e.data));
                    });
                }
                return;
            }
            if (permitted === true) {
                successCB(new constructors.MIDIAccess());
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
        //once we are allowed, lets get the ports list
        dispatcher.addEventListener('allowed', function (e) {
            inputPorts = createPorts(e.data.inputPorts, 'input');
            outputPorts = createPorts(e.data.outputPorts, 'output');
        });
        Object.defineProperties(this, interfaces);
    }

    function exportInterfaceObject(interfaceProto) {
        var identifier = interfaceProto.name,
            functionBody = 'return function ' + identifier + '(){throw new TypeError(\'DOM object constructor cannot be called as a function\')}',
            interfaceObject = new Function(functionBody)(),
            protoProps = {
                writable: false,
                enumerable: false,
                configurable: false,
                value: Object.create(interfaceProto.prototype)
            };
        Object.defineProperty(interfaceObject, 'prototype', protoProps);
        for (var i in interfaceProto.prototype) {
            if (interfaceProto.prototype.hasOwnProperty(i)) {
                interfaceObject.prototype[i] = interfaceProto.prototype[i];
            }
        }
        Object.defineProperty(window, identifier, {enumerable: false, value: interfaceObject});
    }
}(window, window.navigator, window.performance));
