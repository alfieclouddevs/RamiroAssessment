const { filterNullValuesFromObject } = require("../../utils");
const hubspotHandler = require("../client");

const path = ["contacts"];
const properties = [
  "firstname",
  "lastname",
  "jobtitle",
  "email",
  "hubspotscore",
  "hs_lead_status",
  "hs_analytics_source",
  "hs_latest_source",
];

const fetchContacts = async ({ inputs }) => {
  try {
    return await hubspotHandler.fetch({ path, properties, inputs });
  } catch (e) {
    console.log(e);
  }
};

const push = (q) => {
  return async (data = [], map = {}, lastPulledDate) => {
    data.forEach((contact) => {
      if (!contact.properties || !contact.properties.email) return;

      const companyId = map[contact.id]?.[0];

      const isCreated = new Date(contact.createdAt) > lastPulledDate;

      const userProperties = {
        company_id: companyId,
        contact_name: (
          (contact.properties.firstname || "") +
          " " +
          (contact.properties.lastname || "")
        ).trim(),
        contact_title: contact.properties.jobtitle,
        contact_source: contact.properties.hs_analytics_source,
        contact_status: contact.properties.hs_lead_status,
        contact_score: parseInt(contact.properties.hubspotscore) || 0,
      };

      const actionTemplate = {
        includeInAnalytics: 0,
        identity: contact.properties.email,
        userProperties: filterNullValuesFromObject(userProperties),
      };

      q.push({
        actionName: isCreated ? "Contact Created" : "Contact Updated",
        actionDate: new Date(isCreated ? contact.createdAt : contact.updatedAt),
        ...actionTemplate,
      });
    });
  };
};

/**
 * Get recently modified contacts as 100 contacts per page
 */
const processContacts = async (domain, hubId, q) => {
  const pushToQueue = push(q);
  await hubspotHandler.processEntity({
    domain,
    hubId,
    path,
    properties,
    pushToQueue,
    pulledDateProp: "contacts",
    associate: {
      from: "CONTACTS",
      to: "COMPANIES",
    },
  });
};

module.exports = { fetchContacts, processContacts };
