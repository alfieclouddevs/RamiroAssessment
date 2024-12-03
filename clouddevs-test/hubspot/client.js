const R = require("ramda");
const hubspot = require("@hubspot/api-client");
const { saveDomain } = require("../utils");

const hubspotClient = new hubspot.Client({ accessToken: "" });

let expirationDate;

const generateLastModifiedDateFilter = (
  date,
  nowDate,
  propertyName = "hs_lastmodifieddate"
) => {
  const lastModifiedDateFilter = date
    ? {
        filters: [
          { propertyName, operator: "GTE", value: `${date.valueOf()}` },
          { propertyName, operator: "LTE", value: `${nowDate.valueOf()}` },
        ],
      }
    : {};

  return lastModifiedDateFilter;
};
/**
 * Get access token from HubSpot
 */
const refreshAccessToken = async (domain, hubId, tryCount) => {
  const { HUBSPOT_CID, HUBSPOT_CS } = process.env;
  const account = domain.integrations.hubspot.accounts.find(
    (account) => account.hubId === hubId
  );
  const { accessToken, refreshToken } = account;

  return hubspotClient.oauth.tokensApi
    .createToken(
      "refresh_token",
      undefined,
      undefined,
      HUBSPOT_CID,
      HUBSPOT_CS,
      refreshToken
    )
    .then(async (result) => {
      const body = result.body ? result.body : result;

      const newAccessToken = body.accessToken;
      expirationDate = new Date(body.expiresIn * 1000 + new Date().getTime());

      hubspotClient.setAccessToken(newAccessToken);
      if (newAccessToken !== accessToken) {
        account.accessToken = newAccessToken;
      }

      return true;
    });
};

const associateApi = async (data, { from, to }) => {
  let map = {};
  for (let dataBatch of R.splitEvery(100, data)) {
    let response;
    tryCount = 0;
    while (tryCount <= 4) {
      try {
        response = await (
          await hubspotClient.apiRequest({
            method: "POST",
            path: `/crm/v4/associations/${from}/${to}/batch/read`,
            body: {
              inputs: dataBatch.map(({ id }) => ({ id })),
            },
          })
        ).json();
        break;
      } catch (err) {
        tryCount++;

        if (new Date() > expirationDate)
          await refreshAccessToken(domain, hubId);

        await new Promise((resolve) =>
          setTimeout(resolve, 5000 * Math.pow(2, tryCount))
        );
      }
    }
    if (!response) {
      throw new Error(
        "Failed to fetch associations after multiple attempts. Aborting."
      );
    }
    const results = R.pipe(
      R.indexBy(R.path(["from", "id"])),
      R.mapObjIndexed(R.pipe(R.prop("to"), R.pluck("toObjectId")))
    )(response?.results || []);

    map = { ...map, ...results };
  }
  return map;
};

const searchApi = async ({ after, filterGroups, inputs, path, properties }) => {
  const limit = 100;
  const searchObject = {
    limit,
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
    properties,
  };

  if (after) {
    searchObject.after = after;
  }

  if (filterGroups) {
    searchObject.filterGroups = filterGroups;
  }

  if (inputs) {
    searchObject.inputs = inputs;
  }

  let searchResult = {};

  let tryCount = 0;
  while (tryCount <= 4) {
    try {
      const foo = ["crm", ...path, "searchApi"];
      const client = R.path(["crm", ...path, "searchApi"], hubspotClient);
      searchResult = await client.doSearch(searchObject);
      break;
    } catch (err) {
      tryCount++;

      if (new Date() > expirationDate) await refreshAccessToken(domain, hubId);

      await new Promise((resolve) =>
        setTimeout(resolve, 5000 * Math.pow(2, tryCount))
      );
    }
  }

  if (!searchResult) {
    throw new Error("Failed to fetch meetings for the 4th time. Aborting.");
  }

  return searchResult;
};

const fetchFromHubspot = async ({
  associate,
  lastPulledDate,
  inputs,
  path,
  properties,
  pushToQueue,
  timestamp,
}) => {
  const offsetObject = {};
  let hasMore = true;
  let response = [];
  while (hasMore) {
    const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;

    const searchObject = {
      inputs,
      path,
      properties,
      lastPulledDate,
    };

    if (offsetObject.after) {
      searchObject.after = offsetObject.after;
    }
    if (lastModifiedDate) {
      searchObject.filterGroups = [
        generateLastModifiedDateFilter(lastModifiedDate, timestamp),
      ];
    }

    const searchResult = await searchApi(searchObject);

    const data = searchResult?.results || [];
    response = [...response, ...data];
    offsetObject.after = parseInt(searchResult?.paging?.next?.after);

    let maps = {};

    if (associate) {
      maps = await associateApi(data, associate);
    }

    if (pushToQueue) {
      await pushToQueue(data, maps, lastPulledDate);
    }

    response = [...response, ...data];
    if (!offsetObject?.after) {
      hasMore = false;
      break;
    } else if (offsetObject?.after >= 9900) {
      offsetObject.after = 0;
      offsetObject.lastModifiedDate = new Date(
        data[data.length - 1].updatedAt
      ).valueOf();
    }
  }
  return response;
};

const processEntity = async ({
  associate,
  domain,
  hubId,
  path,
  properties,
  pulledDateProp,
  pushToQueue,
}) => {
  const account = domain.integrations.hubspot.accounts.find(
    (account) => account.hubId === hubId
  );
  const lastPulledDate = new Date(account.lastPulledDates[pulledDateProp]);
  const timestamp = new Date();

  await fetchFromHubspot({
    associate,
    lastPulledDate,
    path,
    properties,
    pulledDateProp,
    pushToQueue,
    timestamp,
  });

  account.lastPulledDates.meetings = timestamp;

  await saveDomain(domain);

  return true;
};

const hubspotHandler = {
  fetch: fetchFromHubspot,
  processEntity,
  refreshAccessToken,
};

module.exports = hubspotHandler;
