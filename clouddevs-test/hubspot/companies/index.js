const hubspotHandler = require("../client");

const path = ["companies"];
const properties = [
  "name",
  "domain",
  "country",
  "industry",
  "description",
  "annualrevenue",
  "numberofemployees",
  "hs_lead_status",
];
/**
 * Get recently modified companies as 100 companies per page
 */
const processCompanies = async (domain, hubId, q) => {
  return await hubspotHandler.processEntity({
    domain,
    hubId,
    path,
    properties,
    pulledDateProp: "companies",
  });
};

module.exports = { processCompanies };
