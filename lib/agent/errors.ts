/** Raised when the agent API cannot run because the server or database is not ready. */
export class AgentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentUnavailableError";
  }
}

/** PostgREST / Postgres errors that mean the agent migration is not on this database. */
export function isAgentSchemaMissing(message: string) {
  return /could not find the function|schema cache|function .+ does not exist|relation .+ does not exist/i.test(message);
}
