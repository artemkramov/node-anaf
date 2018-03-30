var Service = require('node-windows').Service;
var path = require('path');

// Create a new service object
var svc = new Service({
    name: 'Help Micro',
    description: 'Web-service to make ANAF reports',
    script: __dirname + path.sep + 'app.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function () {
    svc.start();
});

svc.install();