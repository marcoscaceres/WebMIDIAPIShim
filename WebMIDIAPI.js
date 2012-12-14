/*
TODO: File bug about missing strigifier, which Chris had defined.
*/
(function(global, exports, perf) {
    'use strict';
    var midiIO,
        debug = true;
    if (debug) {
        window.console.warn('Debuggin enabled');
    }
    function requestMIDIAccess(successCallback, errorCallback) {
        function accessGranted(accessor) {
            successCallback(accessor);
        }
        if (typeof successCallback !== 'function') {
            throw new TypeError('expected function');
        }
        midiIO.requestAccess(accessGranted, errorCallback);
    }
    if ('getMIDIAccess' in exports) {
        return; // namespace is taken already, bail!
    }
    midiIO = new JazzPlugin();
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
        var self = this,
            plugin = loadPlugin(),
            timeZero = 0,
            perfTimeZero = perf.now(),
            permitted = null,
            inputPorts = [],
            outputPorts = [],
            dispatcher = document.createElement('x-eventDispatcher'),
            interfaces = {
                timeZero: {
                    get: function() {
                        return timeZero;
                    }
                },
                perfTimeZero: {
                    get: function() {
                        return perfTimeZero;
                    }
                },
                time: {
                    get: function() {
                        return plugin.Time();
                    }
                },
                requestAccess: {
                    value: checkPermission
                },
                midiInList: {
                    get: function() {
                        return inputPorts;
                    }
                },
                midiOutList: {
                    get: function() {
                        return outputPorts;
                    }
                },
                midiInOpen: {
                    value: function(name, callback) {
                        //TODO: check if authorized
                        plugin.MidiInOpen(name, callback);
                    }
                },
                midiOutLong: {
                    value: function(data, name) {
                        if (plugin.MidiOutOpen(name) === name) {
                            //plugin.MidiOut(0x90,60,100);
                            plugin.MidiOutLong(data);
                        }
                    }
                }
            };
        //once we are allowed, lets get the ports list
        dispatcher.addEventListener('allowed', function(e) {
            inputPorts = createPorts(e.data.inputPorts, 'input');
            outputPorts = createPorts(e.data.outputPorts, 'output');
        });

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
                dispatcher.addEventListener('allowed', function() {
                    successCB(new MIDIAccess());
                });
                if (errorCB && typeof errorCB === 'function') {
                    dispatcher.addEventListener('denied', function(e) {
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
            var plugin,
            msg = 'Failed to initialize. Maybe missing Jazz plugin? http://jazz-soft.net/',
                elemId = '_Jazz' + Math.random(),
                objElem = document.createElement('object'),
                fallbackObj = objElem.cloneNode();
            objElem.id = elemId + 'ie';
            objElem.classid = 'CLSID:1ACE1618-1C7D-4561-AEE1-34842AA85E90';
            fallbackObj.id = elemId;
            fallbackObj.type = 'audio/x-jazz';
            objElem.appendChild(fallbackObj);
            document.documentElement.appendChild(objElem);
            plugin = (fallbackObj.isJazz === true) ? fallbackObj : objElem;
            if (!plugin instanceof window.HTMLObjectElement || !(plugin.isJazz)) {
                var e = new window.CustomEvent('error');
                e.data('NotSupportedError');
                dispatcher.dispatchEvent(e);
                return null;
            }
            //Initialize
            plugin.MidiOut(0x80, 0, 0);
            return plugin;
        }

        function requestPermission(plugin) {
            var div = document.createElement('div'),
                style = document.createElement('style'),
                okButton = document.createElement('button'),
                cancelButton = document.createElement('button'),
                id = 'dialog_' + (Math.round(Math.random() * 1000000) + 10000),
                markup = '',
                css = '';
            css += '#' + id + '{ ' + 'width: 60%; ' + 'box-shadow: 0px 2px 20px black; z-index: 1000;' + ' left: 20%; background-color: #aaa;' + ' padding: 3em;' + '} ' + '.hidden{ top: -' + Math.round(window.innerHeight) + 'px; -webkit-transition: all .2s ease-in;}' + '.show{top: 0px; -webkit-transition: all .2s ease-out;}';
            style.innerHTML = css;
            div.id = id;
            markup += '<div>' + '<h1>♫ MIDI ♫</h1>' + '<p>' + window.location.host + ' wants to access your MIDI devices.</p>' + '<p><strong>Input Devices:</strong> ' + plugin.MidiInList().join(', ') + '.</p>' + '<p><strong>Output Devices:</strong> ' + plugin.MidiOutList().join(', ') + '.</p>' + '</div>';
            okButton.innerHTML = 'Allow';
            okButton.onclick = function() {
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
            cancelButton.onclick = function() {
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
            setTimeout(function() {
                div.className = 'show';
            }, 100);
            if (debug) {
                setTimeout(function() {
                    okButton.click();
                }, 500);
            }
        }
        /*
        interface MIDIEvent : Event {
            readonly attribute DOMHighResTimeStamp timestamp;
            readonly attribute Uint8Array          data;
            readonly attribute MIDIPort            port;
        };
        */
        function MIDIEvent(timestamp, data, port) {
            var e = new window.CustomEvent('message'),
                interfaces = {
                    timestamp: {
                        get: function() {
                            return timestamp;
                        }
                    },
                    data: {
                        get: function() {
                            return data;
                        }
                    },
                    port: {
                        get: function() {
                            return port;
                        }
                    }
                };
            Object.defineProperties(e, interfaces);
            return e;
        }
        /*
        interface MIDIPort : EventListener {
        readonly attribute DOMString    id;
        readonly attribute DOMString?   manufacturer;
        readonly attribute DOMString?   name;
        readonly attribute MIDIPortType type;
        readonly attribute DOMString?   version;
                 attribute EventHandler? onmessage;
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
                messageCallback = (type === 'input') ? function(timestamp, data) {
                    var e = new MIDIEvent(timestamp, data, self);
                    dispatcher.dispatchEvent(e);
                } : null,
                interfaces = {
                    id: {
                        get: function() {
                            return id;
                        }
                    },
                    type: {
                        get: function() {
                            return type;
                        }
                    },
                    version: {
                        get: function() {
                            return version;
                        }
                    },
                    name: {
                        get: function() {
                            return deviceName;
                        }
                    },
                    //EventListener - can't extend type so need to implement:(
                    addEventListener: {
                        value: function(type, listener, useCapture) {
                            dispatcher.addEventListener(type, listener, useCapture);
                        }
                    },
                    removeEventListener: {
                        value: function(type, listener, useCapture) {
                            dispatcher.removeEventListener(type, listener, useCapture);
                        }
                    },
                    dispatchEvent: {
                        value: function(evt) {
                            dispatcher.dispatchEvent(evt);
                        }
                    },
                    onmessage: {
                        set: function(aFunction) {
                            //clear prevously set event handler
                            if (eventHandler !== null) {
                                dispatcher.removeEventListener('message', eventHandler, false);
                                eventHandler = null;
                            }
                            //check if callable
                            if (aFunction.call && typeof aFunction.call === 'function') {
                                dispatcher.addEventListener('message', aFunction, false);
                                eventHandler = aFunction;
                            }
                            return eventHandler;
                        },
                        get: function() {
                            return eventHandler;
                        },
                        enumerable: false,
                        configurable: false
                    },
                    send: {
                        value: function(data, timestamp) {
                            return send(self, data, timestamp);
                        }
                    },
                    toString: {
                        value: function toString() {
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
                for (var char, i = 0, l = name.length; i < str.length; i++) {
                    char = str.charCodeAt(i);
                    result = ((result << 5) + result) + char;
                }
                return String(result);
            }

            function send(port, data, timestamp) {
                var delayBeforeSend = (timestamp) ? Math.floor(timestamp - perf.now()) : 0;
                if (port.type === 'input' || !(data) || data.length === 0) {
                    return false;
                }
                if (timestamp && (delayBeforeSend > 1)) {
                    window.setTimeout(send(port, data, timestamp), delayBeforeSend);
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
            MIDIPort           getPortById (DOMString id);
        };
        */
        function MIDIAccess() {
            var interfaces = {
                getInputs: {
                    value: function() {
                        return midiIO.midiInList.slice(0);
                    }
                },
                getOutputs: {
                    value: function() {
                        return midiIO.midiOutList.slice(0);
                    }
                },
                getPortById: {
                    value: function(id) {
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
        Object.defineProperties(this, interfaces);
    }
}(window, window.navigator, window.performance));
