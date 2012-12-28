/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, browser:true, indent:4, maxerr:50 */
/*
 * performance.now()
 * Polyfill of: http://www.w3.org/TR/hr-time/
 *
 * Copyright (c) 2012 Marcos Caceres
 * Licensed under the MIT license.
 */
 (function(exports) {
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
            return function() {
                return Date.now() - start;
            };
        }

        function methodCall(method) {
            return function() {
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
            get: function() {
                return perf;
            }
        });
    }
    Object.defineProperty(exports.performance, 'now', findNowMethod());
}(typeof exports === 'object' && exports || this));
