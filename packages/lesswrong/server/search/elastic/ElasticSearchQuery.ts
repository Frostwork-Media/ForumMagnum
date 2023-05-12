import type { SearchRequest as SearchRequestInfo } from "@elastic/elasticsearch/lib/api/types";
import type { SearchRequest as SearchRequestBody } from "@elastic/elasticsearch/lib/api/typesWithBodyKey";
import { IndexConfig, indexNameToConfig, Ranking } from "./ElasticSearchConfig";

export type QueryFilter = {
  field: string,
} & ({
  type: "facet",
  value: boolean | string,
} | {
  type: "numeric",
  value: number,
  operator: "gt" | "gte" | "lt" | "lte" | "eq",
});

export type QueryData = {
  index: string,
  search: string
  offset?: number,
  limit?: number,
  preTag?: string,
  postTag?: string,
  filters: QueryFilter[],
}

class ElasticSearchQuery {
  constructor(
    private queryData: QueryData,
  ) {}

  private compileRanking({field, order, weight, scoring}: Ranking): string {
    let expr: string;
    switch (scoring.type) {
    case "numeric":
      expr = `saturation(Math.max(0, doc['${field}'].value), ${scoring.pivot}L)`;
      break;
    case "date":
      const start = new Date("2014-06-01T01:00:00Z");
      const delta = Date.now() - start.getTime();
      const dayRange = Math.ceil(delta / (1000 * 60 * 60 * 24));
      expr = `1 - decayDateLinear('${start.toISOString()}', '${dayRange}d', '0', 0.5, doc['${field}'].value)`;
      break;
    case "bool":
      expr = `doc['${field}'].value == true ? 0.75 : 0.25`;
      break;
    }
    if (weight) {
      expr = `((${expr}) * ${weight})`;
    }
    expr = `(doc['${field}'].size() == 0 ? 0 : ${expr})`;
    return order === "asc" ? `(1 - ${expr})` : expr;
  }

  private compileScoreExpression(rankings?: Ranking[]): string {
    let expr = "_score";
    for (const ranking of rankings ?? []) {
      expr += " * " + this.compileRanking(ranking);
    }
    return expr;
  }

  private compileFilters(config: IndexConfig, filters: QueryFilter[]) {
    const terms = [...(config.filters ?? [])];
    for (const filter of filters) {
      switch (filter.type) {
      case "facet":
        terms.push({
          term: {
            [filter.field]: filter.value,
          },
        });
        break;
      }
    }
    return terms.length ? terms : undefined;
  }

  compile(): SearchRequestInfo | SearchRequestBody {
    const {
      index,
      search,
      offset = 0,
      limit = 10,
      preTag,
      postTag,
      filters,
    } = this.queryData;
    const config = indexNameToConfig(index);
    const tags = {
      pre_tags: [preTag ?? "<em>"],
      post_tags: [postTag ?? "</em>"],
    };
    const compiledFilters = this.compileFilters(config, filters);
    return {
      index,
      from: offset,
      size: limit,
      body: {
        track_scores: true,
        track_total_hits: true,
        highlight: {
          fields: {
            [config.snippet]: tags,
            ...(config.highlight && {[config.highlight]: tags}),
          },
          fragment_size: 120,
          no_match_size: 120,
        },
        query: {
          script_score: {
            query: {
              bool: {
                must: {
                  bool: {
                    should: [
                      {
                        multi_match: {
                          query: search,
                          fields: config.fields,
                          fuzziness: "AUTO",
                        },
                      },
                      {
                        multi_match: {
                          query: search,
                          fields: config.fields,
                          type: "phrase",
                          slop: 5,
                        },
                      },
                      {
                        match_phrase_prefix: {
                          [config.fields[0].split("^")[0]]: {
                            query: search,
                            slop: 5,
                          },
                        },
                      },
                    ],
                    minimum_should_match: 1,
                  },
                },
                should: [],
                filter: compiledFilters,
              },
            },
            script: {
              source: this.compileScoreExpression(config.ranking),
            },
          },
        },
        sort: [
          {_score: {order: "desc"}},
          {[config.tiebreaker]: {order: "desc"}},
        ],
      },
    };
  }
}

export default ElasticSearchQuery;
