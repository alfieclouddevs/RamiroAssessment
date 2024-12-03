const { processMeetings } = require("./meetings");
const { processCompanies } = require("./companies");
const { processContacts } = require("./contacts");

module.exports = {
  processContacts,
  processCompanies,
  processMeetings,
};
