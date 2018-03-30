var express = require('express');
var app     = express();
var port    =   8090;
var report = require('./report.js');

// ROUTES
// ==============================================

// sample route with a route the way we're used to seeing it
app.get("/report", function(req, res) {
    var response = {};
    var ip = req.ip;
    //ip = '192.168.0.107';
    report.runReport(ip).then(function () {
        res.json(response);
    }, function (err) {
        response.err = err.message;
        res.json(response);
    });
});

// we'll create our routes here

// START THE SERVER
// ==============================================
app.listen(port);
console.log('Start server');