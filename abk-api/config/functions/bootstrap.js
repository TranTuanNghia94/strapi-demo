'use strict';

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 */

const axios = require('axios');
var admin = require('firebase-admin');
var serviceAccount = require('../airbasket-firebase-adminsdk.json');
var app;

module.exports = cb => {
  if (strapi.emitFirebase == null) {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    strapi.firebaseAdmin = admin;
    strapi.emitFirebase = (message) => {
      app.messaging().send(message)
        .then((response) => {
          // Response is a message ID string.
          console.log('Successfully sent message:', response);
        })
        .catch((error) => {
          console.log('Error sending message:', error);
        });
    }
  }
  if (strapi.sendWebhookTelegram == null) {
    strapi.sendWebhookTelegram = (message) => {
      try {
        axios.post(strapi.config.currentEnvironment.telegramWebHook, {
          text: message
        });
      } catch (e) {
        strapi.error(e)
      }
    }
  }
  cb();
};
