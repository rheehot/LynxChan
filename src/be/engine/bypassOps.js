'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var db = require('../db');
var lang;
var bypasses = db.bypasses();
var expirationToAdd;
var captchaOps;
var floodDisabled;
var floodExpiration;
var bypassMaxPosts;
var bypassMode;

exports.loadSettings = function() {
  var settings = require('../settingsHandler').getGeneralSettings();

  floodExpiration = settings.floodTimerSec;
  bypassMaxPosts = settings.bypassMaxPosts;
  bypassMode = settings.bypassMode;
  floodDisabled = settings.disableFloodCheck;
  expirationToAdd = settings.bypassDurationHours;
};

exports.loadDependencies = function() {

  captchaOps = require('./captchaOps');
  lang = require('./langOps').languagePack;

};

exports.renewBypass = function(captchaId, captchaInput, language, callback) {

  if (!bypassMode) {
    callback(lang(language).errDisabledBypass);
    return;
  }

  captchaOps.attemptCaptcha(captchaId, captchaInput, null, language,
      function solved(error) {

        if (error) {
          callback(error);
        } else {

          var expiration = new Date();
          expiration.setUTCHours(expiration.getUTCHours() + expirationToAdd);

          var newBypass = {
            usesLeft : bypassMaxPosts,
            expiration : expiration
          };

          // style exception, too simple
          bypasses.insertOne(newBypass, function inserted(error) {
            if (error) {
              callback(error);
            } else {
              callback(null, newBypass);
            }
          });
          // style exception, too simple

        }

      });

};

exports.checkBypass = function(bypassId, callback) {

  if (!bypassId || !bypassMode) {
    callback();
    return;
  }

  try {
    bypassId = new ObjectID(bypassId);
  } catch (error) {
    callback();
    return;
  }

  bypasses.findOne({
    _id : bypassId,
    usesLeft : {
      $gt : 0
    },
    expiration : {
      $gt : new Date()
    }
  }, callback);

};

exports.useBypass = function(bypassId, req, callback, thread) {

  if (!bypassMode || !bypassId) {
    return callback();
  }

  try {
    bypassId = new ObjectID(bypassId);
  } catch (error) {
    return callback(null, req);
  }

  var nextUse = new Date();

  var toAdd = (thread ? 10 : 1) * floodExpiration;

  var usageField = thread ? 'nextThreadUsage' : 'nextUsage';

  var setBlock = {};
  setBlock[usageField] = nextUse;

  nextUse.setUTCSeconds(nextUse.getUTCSeconds() + toAdd);

  bypasses.findOneAndUpdate({
    _id : bypassId,
    usesLeft : {
      $gt : 0
    },
    expiration : {
      $gt : new Date()
    }
  }, {
    $inc : {
      usesLeft : -1
    },
    $set : setBlock
  }, function updatedPass(error, result) {

    var errorToReturn;

    if (error) {
      errorToReturn = error;
    } else if (!result.value) {
      return callback(null, req);
    } else if (!floodDisabled && result.value[usageField] > new Date()) {
      errorToReturn = lang(req.language).errFlood;
    } else {
      req.bypassed = true;
      req.bypassId = bypassId;
    }

    callback(errorToReturn, req);

  });

};