'use strict';

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

/**
 * Module dependencies
 */
var path = require('path');
var aws = require('aws-sdk');

var conf = require('nconf')
    .file({ file: path.join(__dirname, 'config', 'global.json') })
    .file('aws', { file: path.join(__dirname, 'config', 'aws.json') });

aws.config.update({
    accessKeyId: conf.get('AWS:AccessKeyId'),
    secretAccessKey: conf.get('AWS:SecretAccessKey'),
    region: conf.get('AWS:Region')
});

/**
 * Server
 */
var worker = function() {
    console.log('Start worker...');

    var sqs = new aws.SQS();

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
            console.log(data);           // successful response

            if (data.Messages) {
                var message = data.Messages[0];
                var receiptHandle = message.ReceiptHandle;

                var deleteParams = {
                    QueueUrl: conf.get('AWS:SQS:QueueUrl'),
                    ReceiptHandle: receiptHandle
                };

                sqs.deleteMessage(deleteParams, function(err, data) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else     console.log(data);           // successful response
                });
            }
        }
    });
};

worker();
