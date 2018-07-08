'use strict';
var AWSXRay = require('aws-xray-sdk');
var AWS = AWSXRay.captureAWS(require('aws-sdk'));
//var AWS = require('aws-sdk');
AWS.config.update({
  region: 'eu-central-1'
});
const fetch = require('node-fetch');
const lambda = new AWS.Lambda();
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB();
const default_url = 'cutom_url';


// This function is for test scenario 1. it downloads an image from a s3 bucket, saves it into
// s3 bukcet under a different name, and then records an item in dynamodb. Under high load, this functions
// times out thanks to default limitations of dynamodb table
module.exports.save = (event, context, callback) => {
  let id = context.awsRequestId;

  fetch(default_url)
    .then((response) => {
      if (response.ok) {
        return response;
      }
      return Promise.reject(new Error(
        `Failed to fetch ${response.url}: ${response.status} ${response.statusText}`));
    })
    .then(response => {
      return response.buffer()
    })
    .then(buffer => {
      return s3.putObject({
        Bucket: process.env.BUCKET,
        Key: context.awsRequestId,
        Body: buffer,
      }).promise()
    }).then(() => {
      console.log('successfully put object in s3');
      let params = {
        Item: {
          "id": {
            S: id
          }
        },
        ConditionExpression: 'attribute_not_exists(id)',
        TableName: process.env.DB_TABLE
      };
      return dynamodb.putItem(params).promise();
    })
    .then(data => {
      console.log('successfully wrote into dynamodb. retunrning result and finishing');

      callback(null, {
        "statusCode": 201,
        "body": JSON.stringify({
          "message": "succeed"
        })

      })
    })
    .catch(error => {
      console.log('error is ', error);
      callback(null, {
        "statusCode": 500,
        "body": JSON.stringify(error)
      })
    });

}


// this function is for test scenario 2. Output format of the function doesnt comply with AWS Prxoy Integration:
// The body porperty of the repsonse isnt stringified. This makes the end user to recieve error.
module.exports.badFormat = (event, context, callback) => {
  let id = context.awsRequestId;

  fetch(default_url)
    .then((response) => {
      if (response.ok) {
        return response;
      }
      return Promise.reject(new Error(
        `Failed to fetch ${response.url}: ${response.status} ${response.statusText}`));
    })
    .then(response => {
      return response.buffer()
    })
    .then(buffer => {
      return s3.putObject({
        Bucket: process.env.BUCKET,
        Key: context.awsRequestId,
        Body: buffer,
      }).promise()
    }).then(() => {
      console.log('successfully put object in s3');
      let params = {
        Item: {
          "id": {
            S: id
          }
        },
        ConditionExpression: 'attribute_not_exists(id)',
        TableName: process.env.DB_TABLE
      };
      return dynamodb.putItem(params).promise();
    })
    .then(data => {
      console.log('successfully wrote into dynamodb. retunrning result and finishing');

      callback(null, {
        "statusCode": 201,
        "body": {
          message: "I have succeeded"
        }

      })
    })
    .catch(error => {
      console.log('error is ', error);
      callback(null, {
        "statusCode": 500,
        "body": {
          message: "I have failed"
        }
      })
    });
}

// this function is for test scenairo 3. It tries to record an item in DynamoDB with duplicate partition key
// and subsequnetly it throws an excpetion.

module.exports.dbError = (event, context, callback) => {

  let id = 'three';

  let params = {
    Item: {
      "id": {
        S: id
      }
    },
    ConditionExpression: 'attribute_not_exists(id)',
    TableName: process.env.DB_TABLE
  };
  dynamodb.putItem(params).promise().then(() => {
    callback(null, {
      "statusCode": 200,
      "body": JSON.stringify({
        "message": "succeed"
      })

    })

  }).catch(error => {
    callback(null, {
      "statusCode": 500,
      "body": JSON.stringify({
        "message": error
      })
    })
  })
}
