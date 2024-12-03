# API Sample Test

## Getting Started

This project requires a newer version of Node. Don't forget to install the NPM packages afterwards.

You should change the name of the `.env.example` file to `.env`.

Run `node app.js` to get things started. Hopefully the project should start without any errors.

## Explanations

The actual task will be explained separately.

This is a very simple project that pulls data from HubSpot's CRM API. It pulls and processes company and contact data from HubSpot but does not insert it into the database.

In HubSpot, contacts can be part of companies. HubSpot calls this relationship an association. That is, a contact has an association with a company. We make a separate call when processing contacts to fetch this association data.

The Domain model is a record signifying a HockeyStack customer. You shouldn't worry about the actual implementation of it. The only important property is the `hubspot`object in `integrations`. This is how we know which HubSpot instance to connect to.

The implementation of the server and the `server.js` is not important for this project.

Every data source in this project was created for test purposes. If any request takes more than 5 seconds to execute, there is something wrong with the implementation.

## Debrief

### Hubspot folder

- Separation for concerns regarding the entities I'm querying from hubspot
- Added "smart" relationships for requesting associated elements using Hubspot API
- Abstracted the query and queue process to reduce work in future implementations.

### Other folders

- Cleaned a little bit the repository, set the queue and models folders.

#### Suggestions for the future

- For readability and/or setting constraints to objects handled, would add assert/zod or some validation library aside from recommending typescript
- Would separated hubspot as a service's subset, and would add any other queue system for processing messages
- Would add a cache system to avoid refetching existing records in hubspot
- Inferring from the word worker, I would clusterize using node to be able to take advantage of multiple threads to process in parallel for each entity.
- Would delegate using system's capabilities to run worker's at a system level.
- Would create a pool to make bulk inserts/updates against mongodb.
