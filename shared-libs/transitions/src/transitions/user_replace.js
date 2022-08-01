/* eslint-disable no-console */
const rpn = require('request-promise-native');
const environment = require('../environment');
const transitionUtils = require('./utils');

const NAME = 'user_replace';

/**
 * Replace a contact with a new contact.
 */
module.exports = {
  name: NAME,
  filter: (doc, info = {}) => {
    return Boolean(
      doc &&
      doc.type === 'person' &&
      doc.secret_code &&
      !transitionUtils.hasRun(info, NAME)
    );
  },
  onMatch: change => {
    return rpn.post({
      url: `${environment.apiUrl}/api/v1/user-replace`,
      json: true,
      body: { reportId: change.doc._id },
      auth: { user: environment.username, pass: environment.password },
    })
      .then(() => true)
      .catch(() => false);
  }
};
