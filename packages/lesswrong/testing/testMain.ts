import '../server';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { onStartupFunctions } from '../lib/executionEnvironment';
import { setServerSettingsCache, setPublicSettings } from '../lib/settingsCache';
import { MongoClient } from 'mongodb';
import { setDatabaseConnection, closeDatabaseConnection } from '../lib/mongoCollection';
import { waitUntilCallbacksFinished } from '../lib/vulcan-lib/callbacks';
import process from 'process';
import jestMongoSetup from '@shelf/jest-mongodb/setup';
import { initGraphQL } from '../server/vulcan-lib/apollo-server/initGraphQL';
import { createVoteableUnionType } from '../server/votingGraphQL';



// Work around an incompatibility between Jest and iconv-lite (which is used
// by mathjax).
require('iconv-lite').encodingExists('UTF-8')
require('encoding/node_modules/iconv-lite').encodingExists('UTF-8')


let dbConnected = false;
async function ensureDbConnection() {
  if (dbConnected)
    return;
  
  try {
    await jestMongoSetup();
    const connectionString = process.env.MONGO_URL as string; //Provided by @shelf/jest-mongodb
    const client = new MongoClient(connectionString, {
      // See https://mongodb.github.io/node-mongodb-native/3.6/api/MongoClient.html
      // for various options that could be tuned here
      
      // A deprecation warning says to use this option 
      useUnifiedTopology: true,
    });
    await client.connect();
    const db = client.db();
    setDatabaseConnection(client, db);
  } catch(err) {
    // eslint-disable-next-line no-console
    console.log("Failed to connect to mongodb: ", err);
    return;
  }
  
  dbConnected = true;
}

let setupRun = false;
async function oneTimeSetup() {
  if (setupRun) return;
  
  setServerSettingsCache({});
  setPublicSettings({});
  
  await ensureDbConnection();
  for (let startupFunction of onStartupFunctions)
    await startupFunction();
  
  // define executableSchema
  createVoteableUnionType();
  initGraphQL();
  
  setupRun = true;
}

export function testStartup() {
  chai.should();
  chai.use(chaiAsPromised);
  
  beforeAll(async () => {
    await oneTimeSetup();
  });
  afterEach(async () => {
    await waitUntilCallbacksFinished();
  });
  afterAll(async () => {
    closeDatabaseConnection();
  });
}
