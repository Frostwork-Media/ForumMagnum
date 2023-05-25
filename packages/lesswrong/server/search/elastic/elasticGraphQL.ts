import {
  addGraphQLResolvers,
  addGraphQLQuery,
  addGraphQLMutation,
} from "../../../lib/vulcan-lib/graphql";
import { userIsAdmin } from "../../../lib/vulcan-users/permissions";
import ElasticSearchExporter from "./ElasticExporter";

addGraphQLResolvers({
  Query: {
    SearchSynonyms(
      _root: void,
      _args: {},
      {currentUser}: ResolverContext,
    ): Promise<string[]> {
      if (!currentUser || !userIsAdmin(currentUser)) {
        throw new Error("This feature is only available to admins");
      }
      const exporter = new ElasticSearchExporter();
      return exporter.getExistingSynonyms();
    },
  },
  Mutation: {
    async UpdateSearchSynonyms(
      _root: void,
      {synonyms}: {synonyms: string[]},
      {currentUser}: ResolverContext,
    ): Promise<string[]> {
      if (!currentUser || !userIsAdmin(currentUser)) {
        throw new Error("This feature is only available to admins");
      }
      const exporter = new ElasticSearchExporter();
      await exporter.updateSynonyms(synonyms);
      return synonyms;
    }
  },
});

addGraphQLQuery("SearchSynonyms: [String!]!");
addGraphQLMutation("UpdateSearchSynonyms(synonyms: [String!]!): [String!]!");
