var request = require('request-promise');
var client = require('./client');
var fs = require('fs');
var dateTime = require('node-datetime');
var path = require('path');
var httpBuildQuery = require('http-build-query');


/**
 * Ip address of the destination
 * @type {string}
 */
var url = '';

/**
 * URI of the ANAF table
 * @type {string}
 */
var uriANAF = '/cgi/tbl/ANAF';

/**
 * URI of the cash register state
 * @type {string}
 */
var uriState = '/cgi/state';

/**
 * URI of the XML-report A4200
 * @type {string}
 */
var uriA4200 = '/cgi/anaf/a4200';

/**
 * URI if the XML-report A4203
 * @type {string}
 */
var uriA4203 = '/cgi/anaf/a4203';

/**
 * Undefined variable
 */
var undefined;

/**
 * Files collection to export
 * @type {Array}
 */
var files = [];

/**
 * All possible states of the cash register
 * @type {{}}
 */
var stateEnum = {
    WORK_MODE: 0,
    REPORT_MODE: 1,
    READY_MODE: 2,
    READ_MODE: 3,
    READ_SUCCESS: 4,
    READ_FAIL: 5
};
Object.freeze(stateEnum);

const DefaultTimeout = 1500;

/**
 * Get all XML files from the given IP address
 * @param address
 * @returns {Promise}
 */
exports.runReport = function (address) {
    return new Promise(function (resolve, reject) {
        /**
         * Remove extra symbols from the IP beginning
         */
        if (address.substr(0, 7) == "::ffff:") {
            address = address.substr(7)
        }
        url = 'http://';
        url += address;

        /**
         * Set URL in client
         */
        client.setUrl(url);

        /**
         * Fetch last Z-report
         */
        getLastZReport().then(function (response) {
            var lastZReport = response.currZ;

            /**
             * Fetch last exported Z-report
             */
            getLastExportedZReport().then(function (responseANAF) {
                var lastExportedZReport = responseANAF.SendZ;

                /**
                 * Process reports from the given range
                 */
                processReport(lastZReport, lastExportedZReport).then(function () {
                    resolve();
                }, function (err) {
                    reject(err);
                });
            }, function (err) {
                reject(err);
            });
        }, function (err) {
            reject(err);
        });
    });
};

/**
 * Make report from the given range
 * @param start
 * @param end
 * @returns {Promise}
 */
function processReport(start, end) {
    files = [];
    // if (end !== 0) {
    //     start += 1;
    // }
    return new Promise(function (resolve, reject) {

        /**
         * Get A4200 XML
         */
        var queryString = httpBuildQuery({
            from: start,
            to: end
        });
        client.runRequest(uriA4200 + '?' + queryString, 'GET').then(function (responseA4200) {
            files.push({
                name: 'a4200_' + start + '_' + end,
                content: responseA4200
            });

            /**
             * Get all corresponding A4203 files
             */
            processA4203(start, end, function (err) {

                /**
                 * If all files were generated successfully
                 */
                if (files.length == 2 + end - start) {

                    /**
                     * Write files to the filesystem
                     */
                    var response = writeFiles(start, end);
                    if (response === true) {

                        resolve();
                        // /**
                        //  * Update ANAF table
                        //  */
                        // updateANAF(end).then(function () {
                        //     resolve();
                        // }, function (err) {
                        //     reject(err);
                        // });
                    }
                    else {
                        reject(response);
                    }

                }
                else {
                    reject(err);
                }
            });
        }, function (err) {
            reject(err);
        });
    });
}

/**
 * Write files to folder
 * @param start
 * @param end
 * @returns {*}
 */
function writeFiles(start, end) {
    var dt = dateTime.create();
    var formatted = dt.format('Y-m-d-H-M-S');
    var folderName = formatted + '_' + start + '_' + end;
    var folderPath = __dirname + path.sep + 'data' + path.sep + folderName;
    if (!fs.existsSync(folderPath)) {
        try {
            fs.mkdirSync(folderPath);
        }
        catch (err) {
            return err;
        }
    }
    files.forEach(function (file) {
        var filePath = folderPath + path.sep + file.name + '.xml';
        fs.writeFile(filePath, file.content, function (err) {
            if (err) return err;
        });
    });
    return true;
}

/**
 * Update info about the last exported Z-report
 * @param zReport
 * @returns {Promise}
 */
function updateANAF(zReport) {
    return new Promise(function (resolve, reject) {
        client.runRequest(uriANAF, 'POST', {
            'SendZ': zReport
        }, {
            json: true,
            headers: {
                'X-HTTP-Method-Override': 'PATCH'
            }
        }).then(function () {
            resolve();
        }, function (err) {
            reject(err);
        });
    });
}

function updateANAFStatus(statusID) {
    return new Promise(function (resolve, reject) {
        client.runRequest(uriANAF, 'POST', {
            State: statusID
        }, {
            json: true,
            timeout: 30000,
            headers: {
                'X-HTTP-Method-Override': 'PATCH'
            }
        }).then(function (response) {
            resolve();
        }, function (err) {
            reject(err);
        });
    });
}

/**
 * Process A4203 report
 * @param currentZ
 * @param end
 * @param callback
 */
function processA4203(currentZ, end, callback) {
    var queryString = httpBuildQuery({
        z: currentZ
    });
    client.runRequest(uriA4203 + '?' + queryString, 'GET').then(function (responseXML) {
        files.push({
            name: 'a4203_' + currentZ,
            content: responseXML
        });
        /**
         * If current Z-report number is less than last
         * than continue
         * Else run callback function
         */
        if (currentZ < end) {
            processA4203(currentZ + 1, end, callback);
        }
        else {
            callback();
        }
    }, function (err) {
        callback(err);
    });
}

/**
 * Get last Z-report number
 * @returns {Promise}
 */
function getLastZReport() {
    return new Promise(function (resolve, reject) {
        client.runRequest(uriState, 'GET', undefined, {json: true}).then(function (response) {
            resolve(response);
        }, function (err) {
            reject(err);
        });
    });
}

/**
 * Get the number of the last exported Z-report
 * @returns {Promise}
 */
function getLastExportedZReport() {
    return new Promise(function (resolve, reject) {
        client.runRequest(uriANAF, 'GET', undefined, {json: true}).then(function (response) {
            resolve(response);
        }, function (err) {
            reject(err);
        });
    });
}

/**
 * Get current state of the button
 * @returns {Promise}
 */
exports.getCurrentANAFState = function () {
    return new Promise(function (resolve, reject) {
        client.runRequest(uriANAF, 'GET', undefined, {json: true, timeout: DefaultTimeout }).then(function (response) {
            resolve(response);
        }, function (err) {
            reject(err);
        });
    });
};

/**
 * Set ip address of the cash register
 * @param address
 */
exports.setIPAddress = function (address) {
    /**
     * Remove extra symbols from the IP beginning
     */
    if (address.substr(0, 7) == "::ffff:") {
        address = address.substr(7)
    }
    url = 'http://';
    url += address;

    /**
     * Set URL in client
     */
    client.setUrl(url);
};

exports.processANAFState = function (state) {
    return new Promise(function (resolve, reject) {
        switch (state["State"]) {
            case stateEnum['REPORT_MODE']:

                /**
                 * Rewrite the status of the cash register
                 * Update ANAF table
                 */
                updateANAFStatus(stateEnum['READY_MODE']).then(function () {
                    resolve("Detect button pressing and change status");
                }, function (error) {
                    reject(error);
                });
                break;
            case stateEnum['READ_MODE']:

                /**
                 * Read Z report range
                 * and run the report on this range
                 */
                var fromZ = state["FromZ"];
                var toZ = state["ToZ"];

                /**
                 * Process reports from the given range
                 */
                processReport(fromZ, toZ).then(function () {

                    /**
                     * In case of success report export
                     * set the appropriate status
                     */
                    updateANAFStatus(stateEnum['READ_SUCCESS']).then(function () {
                        resolve("Export was made successfully!");
                    }, function () {
                        reject();
                    });
                }, function (err) {

                    /**
                     * In case of the error detection during the report export
                     * set the appropriate status
                     */
                    updateANAFStatus(stateEnum['READ_FAIL']).then(function () {
                        reject("Export process failed");
                    }, function () {
                        reject();
                    });
                });
                break;
            default:
                resolve("Button was not pressed");
                break;
        }
    });
};


