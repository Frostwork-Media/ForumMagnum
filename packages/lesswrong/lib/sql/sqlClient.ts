import { isAnyTest } from "../executionEnvironment";
import type { DbTarget } from "./PgCollection";

export const logAllQueries = false;
const SLOW_QUERY_REPORT_CUTOFF_MS = 2000;

/** Main sql client which is safe to use for all queries */
let sql: SqlClient | null = null;
/** Client to use for read operations only.
 *  Currently used in the EA Forum bot environment to decrease load on the main database
 */
let sqlRead: SqlClient | null = null;

export const setSqlClient = (sql_: SqlClient, target: DbTarget = "write") => {
  if (target === "write") {
    sql = sql_;
  } else {
    sqlRead = sql_;
  }
}

export const getSqlClient = (target: DbTarget = "write") => {
  return target === "write" || !sqlRead ? sql : sqlRead;
}

export const getSqlClientOrThrow = (target: DbTarget = "write") => {
  const client = (target === "write" || !sqlRead) ? sql : sqlRead;
  if (!client) {
    throw new Error("SQL Client is not initialized");
  }
  return client;
}


// Note: this is only used in tests so doesn't need to handle the read/write distinction
export const closeSqlClient = async (client: SqlClient) => {
  if (client === sql) {
    sql = null;
  }
  await client.$pool.end();
}

export const runSqlQuery = async (query: string, args?: any, target: DbTarget = "write") => {
  const client = getSqlClientOrThrow(target);
  return await logIfSlow(
    () => client.any(query, args),
    () => `${query}: ${JSON.stringify(args)}`
  );
}

let queriesExecuted = 0;

export async function logIfSlow<T>(execute: ()=>Promise<T>, describe: string|(()=>string), quiet?: boolean) {
  function getDescription(): string {
    const describeString = typeof describe==='string' ? describe : describe();
    // Truncate this at a pretty high limit, just to avoid logging things like entire rendered pages
    return describeString.slice(0, 5000);
  }
  
  let queryID: number = ++queriesExecuted;
  if (logAllQueries) {
    // eslint-disable-next-line no-console
    console.log(`Running Postgres query #${queryID}: ${getDescription()}`);
  }
  
  const startTime = new Date().getTime();
  const result = await execute()
  const endTime = new Date().getTime();

  const milliseconds = endTime - startTime;
  if (logAllQueries) {
    // eslint-disable-next-line no-console
    console.log(`Finished query #${queryID} (${milliseconds} ms)`);
  } else if (milliseconds > SLOW_QUERY_REPORT_CUTOFF_MS && !quiet && !isAnyTest) {
    // eslint-disable-next-line no-console
    console.trace(`Slow Postgres query detected (${milliseconds} ms): ${getDescription()}`);
  }

  return result;
}

export const replaceDbNameInPgConnectionString = (connectionString: string, dbName: string): string => {
  if (!/^postgres:\/\/.*\/[^/]+$/.test(connectionString)) {
    throw `Incorrectly formatted connection string or unrecognized connection string format: ${connectionString}`;
  }
  const lastSlash = connectionString.lastIndexOf('/');
  const withoutDbName = connectionString.slice(0, lastSlash);
  return `${withoutDbName}/${dbName}`;
}
