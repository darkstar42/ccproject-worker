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
};

worker();
