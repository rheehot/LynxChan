'use strict';

// handles moderation pages. The difference between moderation and management is
// that moderation is focused on restricting users

var JSDOM = require('jsdom').JSDOM;
var debug = require('../../../kernel').debug();
var templateHandler;
var lang;
var miscOps;
var common;

var boardModerationIdentifiers = [ 'boardTransferIdentifier',
    'boardDeletionIdentifier', 'specialSettingsIdentifier' ];

var specialSettingsRelation = {
  sfw : 'checkboxSfw',
  locked : 'checkboxLocked'
};

exports.loadDependencies = function() {

  miscOps = require('../../miscOps');
  templateHandler = require('../../templateHandler').getTemplates;
  lang = require('../../langOps').languagePack;
  common = require('..').common;

};

exports.bans = function(bans, globalPage, language) {

  try {

    var document = templateHandler(language, true).bansPage.template.replace(
        '__title__', lang(language).titBansManagement);

    return document.replace('__bansDiv_children__', common.getBanList(bans,
        globalPage, language));

  } catch (error) {
    return error.stack.replace(/\n/g, '<br>');
  }

};

// Section 1: Closed reports {
exports.setClosedReportCell = function(cell, report, language) {

  cell.innerHTML = templateHandler(language).closedReportCell;
  cell.setAttribute('class', 'closedReportCell');

  if (report.reason) {
    var reason = cell.getElementsByClassName('reasonLabel')[0];
    reason.innerHTML = report.reason;
  }

  var reportLink = cell.getElementsByClassName('link')[0];
  reportLink.setAttribute('href', common.getReportLink(report));

  var closedBy = cell.getElementsByClassName('closedByLabel')[0];
  closedBy.innerHTML = report.closedBy;

  var closedDate = cell.getElementsByClassName('closedDateLabel')[0];
  closedDate.innerHTML = report.closing;
};

exports.closedReports = function(reports, language) {

  try {
    var dom = new JSDOM(templateHandler(language).closedReportsPage);
    var document = dom.window.document;

    document.title = lang(language).titClosedReports;

    var reportsDiv = document.getElementById('reportDiv');

    for (var i = 0; i < reports.length; i++) {

      var cell = document.createElement('div');

      exports.setClosedReportCell(cell, reports[i], language);

      reportsDiv.appendChild(cell);

    }

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};
// } Section 1: Closed reports

// Section 2: Range bans {
exports.setRangeBanCells = function(document, rangeBans, boardData, language) {

  var bansDiv = document.getElementById('rangeBansDiv');

  for (var i = 0; i < rangeBans.length; i++) {
    var rangeBan = rangeBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler(language).rangeBanCell;
    common.setFormCellBoilerPlate(banCell, '/liftBan.js', 'rangeBanCell');

    var rangeToUse;

    if (boardData) {
      rangeToUse = miscOps.hashIpForDisplay(rangeBan.range, boardData.ipSalt);
    } else {
      rangeToUse = rangeBan.range.join('.');
    }

    banCell.getElementsByClassName('rangeLabel')[0].innerHTML = rangeToUse;
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        rangeBan._id);

    bansDiv.appendChild(banCell);

  }

};

exports.rangeBans = function(rangeBans, boardData, language) {

  try {

    var dom = new JSDOM(templateHandler(language).rangeBansPage);
    var document = dom.window.document;

    document.title = lang(language).titRangeBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardData) {
      boardIdentifier.setAttribute('value', boardData.boardUri);
    } else {
      boardIdentifier.remove();
    }

    exports.setRangeBanCells(document, rangeBans, boardData, language);

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 2: Range bans

// Section 3: Hash bans {
exports.setHashBanCells = function(document, hashBans, language) {

  var bansDiv = document.getElementById('hashBansDiv');

  for (var i = 0; i < hashBans.length; i++) {
    var hashBan = hashBans[i];

    var banCell = document.createElement('form');
    banCell.innerHTML = templateHandler(language).hashBanCell;
    common.setFormCellBoilerPlate(banCell, '/liftHashBan.js', 'hashBanCell');

    banCell.getElementsByClassName('hashLabel')[0].innerHTML = hashBan.md5;
    banCell.getElementsByClassName('idIdentifier')[0].setAttribute('value',
        hashBan._id);

    bansDiv.appendChild(banCell);
  }

};

exports.hashBans = function(hashBans, boardUri, language) {

  try {

    var dom = new JSDOM(templateHandler(language).hashBansPage);
    var document = dom.window.document;

    document.title = lang(language).titHashBans;

    var boardIdentifier = document.getElementById('boardIdentifier');

    if (boardUri) {
      boardIdentifier.setAttribute('value', boardUri);
    } else {
      boardIdentifier.remove();
    }

    exports.setHashBanCells(document, hashBans, language);

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }
};
// } Section 3: Hash bans

// Section 4: Board moderation {
exports.setSpecialCheckboxesAndIdentifiers = function(document, boardData) {

  var specialSettings = boardData.specialSettings || [];

  for ( var key in specialSettingsRelation) {

    if (!specialSettingsRelation.hasOwnProperty(key)) {
      continue;
    }

    if (specialSettings.indexOf(key) > -1) {
      document.getElementById(specialSettingsRelation[key]).setAttribute(
          'checked', true);
    }
  }

  for (var i = 0; i < boardModerationIdentifiers.length; i++) {
    document.getElementById(boardModerationIdentifiers[i]).setAttribute(
        'value', boardData.boardUri);
  }

};

exports.fillVolunteers = function(document, volunteers) {

  if (!volunteers) {
    return;
  }

  var div = document.getElementById('divVolunteers');

  for (var i = 0; i < volunteers.length; i++) {

    var cell = document.createElement('div');
    cell.innerHTML = volunteers[i];

    div.appendChild(cell);

  }

};

exports.boardModeration = function(boardData, ownerData, language) {

  try {

    var dom = new JSDOM(templateHandler(language).boardModerationPage);
    var document = dom.window.document;

    document.title = lang(language).titBoardModeration.replace('{$board}',
        boardData.boardUri);

    exports.fillVolunteers(document, boardData.volunteers);

    exports.setSpecialCheckboxesAndIdentifiers(document, boardData);

    document.getElementById('labelOwner').innerHTML = ownerData.login;

    document.getElementById('labelLastSeen').innerHTML = ownerData.lastSeen;

    var title = '/' + boardData.boardUri + '/ - ' + boardData.boardName;
    document.getElementById('labelTitle').innerHTML = title;

    return dom.serialize();

  } catch (error) {

    return error.stack.replace(/\n/g, '<br>');
  }

};
// } Section 4: Board moderation
