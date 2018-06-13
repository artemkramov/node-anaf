var undefined;

global.ip = undefined;
// if (process.argv.length > 2 && process.argv[2] != undefined) {
//     global.ip = process.argv[2];
// }

var report = require('./report.js');

var commonErrorMessage = "Device is offline";

// Global variable to check if the processing ability is locked
global.isLocked = false;

// Global variable to check if the SSDP search process is locked
global.isSSDPLocked = false;

// Timeout interval to examine the cash register
var interval = 3000;

// Timeout to search cash register via SSDP
var timeoutSSDP = 2000;

var ssdp = require('node-upnp-ssdp');
// var client = new ssdp();

var urn = 'urn:help-micro.kiev.ua:device:webdev:1';

ssdp.on('DeviceFound', function (data) {
    var ip = data.address;
    if (global.ip == undefined && checkIP(ip)) {
        global.ip = ip;
        global.isSSDPLocked = false;
    }
});



// client.on('notify', function () {
//     console.log('Notify', arguments);
//
// });
//
// client.on('response', function inResponse(msg, rinfo) {
//     if (rinfo != undefined && rinfo['address'] != undefined && global.ip == undefined && checkIP(rinfo['address'])) {
//         global.ip = rinfo['address'];
//         global.isSSDPLocked = false;
//         try {
//             // client.stop();
//         }
//         catch (error) {}
//     }
// });

function checkIP(ip) {
    return ip != undefined && ip.indexOf("169.254") != -1;

}

function searchDevices() {
    return new Promise(function (resolve, reject) {
        // client.search(urn);
        // setTimeout(function () {
        //     try {
        // //        client.stop();
        //     }
        //     catch (error) {}
        //     resolve();
        // }, timeoutSSDP);
        try {
            ssdp.mSearch(urn);
        }
        catch (error) {}
        resolve();
    });
}

setInterval(function () {
    console.log('Interval', global.ip);
    if (global.ip == undefined) {
        if (!global.isSSDPLocked) {
            global.isSSDPLocked = true;
            searchDevices().then(function () {
                global.isSSDPLocked = false;
            });
        }
    }
    else {
        report.setIPAddress(global.ip);
        if (!global.isLocked) {
            global.isLocked = true;
            report.getCurrentANAFState().then(function (state) {
                report.processANAFState(state).then(function (message) {
                    console.log(message);
                }, function (errorMessage) {
                    if (errorMessage == undefined) {
                        errorMessage = commonErrorMessage;
                    }
                    console.log(errorMessage);
                })
                // Always handler
                    .then(function () {
                        global.isLocked = false;

                    });
            }, function () {
                console.log(commonErrorMessage);
                global.isLocked = false;
                global.ip = undefined;
            });
        }
    }
}, interval);