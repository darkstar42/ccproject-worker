'use strict';

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

/**
 * Module dependencies
 */
var path = require('path');
var aws = require('aws-sdk');
var https = require('https');
var fs = require('fs.extra');
var mkdirp = require('mkdirp');
var walk = require('walk');
var mime = require('mime');
var uuid = require('node-uuid');
var DockerCmdManager = require('docker-cmd').Manager;
var DockerCmd = require("docker-cmd");
var dockerCmd = new DockerCmd();

global.appRoot = path.resolve(__dirname);

var conf = require('nconf')
    .file({ file: path.join(__dirname, 'config', 'global.json') })
    .file('aws', { file: path.join(__dirname, 'config', 'aws.json') });

aws.config.update({
    accessKeyId: conf.get('AWS:AccessKeyId'),
    secretAccessKey: conf.get('AWS:SecretAccessKey'),
    region: conf.get('AWS:Region')
});

var sqs = new aws.SQS();

var dockerCmdManager = new DockerCmdManager(appRoot + '/dockerDescriptions/dockerdesc.json');

var fileService = require(appRoot + '/services/file')();
var notificationService = require(appRoot + '/services/notification')();

/**
 * Server
 */
var worker = function() {
    console.log('Start worker...');

    receiveMessage(handleMessage);
};

function runCmd(image, command, entryId, folderId) {
    var workDir = '/tmp/' + uuid.v4();

    var getFileCallback = function(err, file) {
        if (err) throw Error(err);

        var url = file.downloadUrl;
        var dst = workDir + '/' + file.entryId;

        downloadFile(url, dst, downloadFileCallback);
    };

    var downloadFileCallback = function() {
        dockerCmdManager.build(image, function(dockerBuildExitCode) {
            console.log(image + ' built');
            console.dir(dockerBuildExitCode);

            dockerCmd.run({
                name: image,
                "_": [
                    image,
                    "/bin/bash",
                    "-c",
                    command
                ],
                "rm": true,
                "volume": workDir + ":/download",
                "detach": "false",
                "interactive": "false"
            }, null, function(dockerRunExitCode) {
                var walker = walk.walk(workDir);

                walker.on("file", function (root, fileStats, next) {
                    if (fileStats.name === entryId || fileStats.size === 0) {
                        next();
                    } else {
                        var filepath = workDir + '/' + fileStats.name;
                        var fileData = {
                            name: fileStats.name,
                            size: fileStats.size,
                            type: mime.lookup(filepath),
                            path: filepath
                        };

                        fileService.upload(folderId, fileData, function (err, newFile) {
                            console.dir(err);
                            console.dir(newFile);
                            next();
                        });
                    }
                });

                walker.on("errors", function (root, nodeStatsArray, next) {
                    console.dir('ERROR');
                    next();
                });

                walker.on("end", function () {
                    fs.rmrfSync(workDir);
                    console.log('job run and finished.');

                    var notification = notificationService.createNotification('foo', 'Job finished - ' + image + ': ' + command);
                    notificationService.saveNotification(notification, function(err) {
                        receiveMessage(handleMessage);
                    });
                });
            });
        });
    };

    mkdirp(workDir, function (err) {
        if (err) {
            console.error(err);
        } else {
            var notification = notificationService.createNotification('foo', 'Execute ' + image + ': ' + command);
            notificationService.saveNotification(notification, function(err) {
                fileService.getFile(entryId, getFileCallback);
            });
        }
    });
}

function handleMessage(err, message) {
    if (err) throw new Error('Something went wrong...');

    try {
        var data = JSON.parse(message.Body);

        if (data.type && data.type === 'job') {
            runCmd(data.image, data.cmd, data.src, data.dst);
        } else {
            console.log('Malformed message body detected:');
            console.dir(data);

            receiveMessage(handleMessage);
        }
    } catch (e) {
        console.dir(e);
        receiveMessage(handleMessage);
    }
}

function receiveMessage(callback) {
    console.log('Waiting for message..');

    var params = {
        QueueUrl: conf.get('AWS:SQS:QueueUrl'),
        AttributeNames: [
            'All'
        ],
        MaxNumberOfMessages: 1,
        VisibilityTimeout: 0,
        WaitTimeSeconds: 20
    };

    sqs.receiveMessage(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            if (data.Messages) {
                var message = data.Messages[0];
                var receiptHandle = message.ReceiptHandle;

                var deleteParams = {
                    QueueUrl: conf.get('AWS:SQS:QueueUrl'),
                    ReceiptHandle: receiptHandle
                };

                sqs.deleteMessage(deleteParams, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                        callback(err);
                    } else {
                        console.log('Message found...');
                        callback(null, message);
                    }
                });
            } else {
                console.log('No message found..');
                receiveMessage(callback);
            }
        }
    });
}

function downloadFile(url, destination, callback) {
    console.log('Download ' + url + '...');

    var file = fs.createWriteStream(destination);
    var request = https.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            console.log('done');
            file.close(callback);
        });
    });
}

worker();
