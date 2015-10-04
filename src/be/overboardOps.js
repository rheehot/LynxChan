'use strict';

var mongo = require('mongodb');
var ObjectID = mongo.ObjectID;
var genQueue = require('./generationQueue');
var settings = require('./settingsHandler').getGeneralSettings();
var overboardSize = settings.overBoardThreadCount;
var db = require('./db');
var overboardThreads = db.overboardThreads();
var threads = db.threads();

exports.reload = function() {
  settings = require('./settingsHandler').getGeneralSettings();
  overboardSize = settings.overBoardThreadCount;
};

// Section 1: Overboard insertion {

// Section 1.1: Overboard pruning {
function getThreadsToRemove(toRemove, ids, message) {

  threads.find({
    _id : {
      $in : ids
    }
  }, {
    threadId : 1
  }).sort({
    lastBump : 1
  }).limit(toRemove).toArray(function(error, foundThreads) {

    if (error) {
      console.log(error);
    } else {

      var idsToRemove = [];

      for (var i = 0; i < foundThreads.length; i++) {
        idsToRemove.push(new ObjectID(foundThreads[i]._id));
      }

      // style exception, too simple
      overboardThreads.deleteMany({
        thread : {
          $in : idsToRemove
        }
      }, function removed(error) {
        if (error) {
          console.log(error);
        } else {
          genQueue.queue(message);
        }
      });
      // style exception, too simple

    }
  });
}

function checkAmount(message) {

  overboardThreads.count({}, function gotCount(error, count) {

    if (error) {
      console.log(error);
    } else if (count > overboardSize) {

      // style exception, too simple
      overboardThreads.aggregate([ {
        $group : {
          _id : 0,
          ids : {
            $push : '$thread'
          }
        }
      } ], function gotThreads(error, foundThreads) {

        if (error) {
          console.log(error);
        } else if (!foundThreads.length) {
          // will probably never fall into this condition
          genQueue.queue(message);

        } else {
          getThreadsToRemove(count - overboardSize, foundThreads[0].ids,
              message);
        }

      });
      // style exception, too simple

    } else {
      genQueue.queue(message);
    }

  });

}
// } Section 1.1: Overboard pruning

function addThread(message) {

  overboardThreads.insert({
    thread : new ObjectID(message._id)
  }, function(error) {

    if (error) {
      console.log(error);
    } else {
      checkAmount(message);
    }

  });

}
// } Section 1: Overboard insertion

function checkForExistance(message, insert) {

  overboardThreads.findOne({
    thread : new ObjectID(message._id)
  }, function gotThread(error, thread) {
    if (error) {
      console.log(error);
    } else if (thread) {
      genQueue.queue(message);
    } else if (insert) {
      addThread(message);
    }

  });

}

exports.reaggregate = function(message) {

  if (!message.post) {
    addThread(message);
  } else {
    checkForExistance(message, message.bump);
  }

};