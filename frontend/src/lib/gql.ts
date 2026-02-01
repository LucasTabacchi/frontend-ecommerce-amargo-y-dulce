import { GraphQLClient } from "graphql-request";

export function gqlClient() {
  // apunta al proxy de Next (misma origin)
  return new GraphQLClient("/api/graphql");
}
