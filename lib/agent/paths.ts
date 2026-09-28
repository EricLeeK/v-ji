/** Routes that authenticate with a bearer token and must return JSON instead of a login redirect. */
export function isAgentApiPath(pathname: string) {
  return pathname === "/api/mcp" || pathname.startsWith("/api/mcp/") || pathname === "/api/v1" || pathname.startsWith("/api/v1/");
}
