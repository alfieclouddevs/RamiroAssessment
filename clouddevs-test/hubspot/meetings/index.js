const R = require("ramda");
const { filterNullValuesFromObject } = require("../../utils");
const { fetchContacts } = require("../contacts");
const hubspotHandler = require("../client");

const path = ["objects", "meetings"];
const properties = [
  "hs_meeting_title",
  "hs_meeting_start_time",
  "hs_meeting_end_time",
  "hs_meeting_outcome",
];

const fetchMeetingsContacts = async (map) => {
  const inputs = R.uniq(Object.values(map).flat()).map((id) => ({ id }));

  const contacts = await fetchContacts({ inputs });

  return R.indexBy(R.prop("id"), contacts);
};

const push = (q) => {
  return async (data = [], map = {}, lastPulledDate) => {
    const indexedContacts = await fetchMeetingsContacts(map);

    data.forEach(({ id, createdAt, properties, updatedAt }) => {
      if (!properties) return;

      const contacts = map[id] || [];
      const actionTemplate = {
        includeInAnalytics: 0,
        meetingProperties: filterNullValuesFromObject({
          meeting_id: id,
          meeting_title: properties.hs_meeting_title,
          meeting_start_time: properties.hs_meeting_start_time,
          meeting_end_time: properties.hs_meeting_end_time,
          meeting_outcome: properties.hs_meeting_outcome,
          meeting_contact_emails: contacts.map(
            (contactId) => indexedContacts[contactId]?.properties.email
          ),
        }),
      };
      const isCreated = !lastPulledDate || new Date(createdAt) > lastPulledDate;

      q.push({
        actionName: isCreated ? "Meeting Created" : "Meeting Updated",
        actionDate: new Date(isCreated ? createdAt : updatedAt) - 2000,
        ...actionTemplate,
      });
    });
  };
};

/**
 * Get recently modified meetings as 100 meetings per page
 */
const processMeetings = async (domain, hubId, q) => {
  const pushToQueue = push(q);
  return await hubspotHandler.processEntity({
    domain,
    hubId,
    path,
    properties,
    pushToQueue,
    pulledDateProp: "meetings",
    associate: {
      from: "MEETINGS",
      to: "CONTACTS",
    },
  });
};

module.exports = {
  processMeetings,
};
