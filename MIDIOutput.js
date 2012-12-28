/*
interface MIDIOutput : MIDIPort {
    void send (any data, optional double? timestamp);
};
*/
(function implementMIDIOutput(exports, MIDIPort, midiIO) {
    //Set up prototype interface object and inheritance chain
    function MIDIOutput(name) {
        MIDIPort.call(this, name);
    }
    MIDIOutput.prototype = Object.create(MIDIPort.prototype);
    MIDIOutput.constructor = MIDIOutput;
    
    //void send (any data, optional double? timestamp);
    MIDIOutput.prototype.send = function send(data, timestamp) {
        if (!this instanceof MIDIOutput) {
            throw new TypeError("Illegal invocation");
        }
        //TODO: implement proper type check per WebIDL
        if (!(data instanceof Uint8Array)) {
            data = new Uint8Array(data);
        }
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
    Object.defineProperty(MIDIOutput.prototype, "send", {
        configurable: false
    });

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
            midiIO.midiOutLong(data, port.name);
        }
        return true;
    }
    //Expose interface object as per WebIDL 
    (function () {
        var MIDIOutputInterfaceObj = function MIDIOutput() {
            throw new TypeError("DOM object constructor cannot be called as a function");
        };
        var protoProps = {
            writable: false,
            enumerable: false,
            configurable: false,
            value: Object.create(MIDIOutput.prototype)
        };
        MIDIOutputInterfaceObj.prototype.send = MIDIOutput.prototype.send;
        Object.defineProperty(MIDIOutputInterfaceObj, "prototype", protoProps);
        var prop = {
            writable: true,
            enumerable: false,
            configurable: true,
            value: MIDIOutputInterfaceObj
        };
        Object.defineProperty(exports, "MIDIOutput", prop);
    }(exports));
}(window, MIDIPort, midiIO));