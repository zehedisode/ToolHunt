import type { RecommendationGroup, Result, StackProfile, ToolRecord } from "../types/index.js";
import { ok, err } from "../types/index.js";
import { analyzeProject } from "../mcp/tools/analyze.js";
import { searchTools } from "../mcp/tools/search.js";
import { getRecommendationsByCategory } from "../mcp/tools/recommend.js";
import { saveStack, saveTools, saveRecommendations } from "../storage/db.js";

export interface ScanResult {
  stack: StackProfile;
  tools: ToolRecord[];
  recommendations: RecommendationGroup[];
  webSearchUnavailable: boolean;
}

/**
 * Full scan pipeline: analyze -> search -> recommend -> persist. Each stage
 * failure is reported with the failing stage; previously stored data is
 * retained by the persistence layer.
 */
export async function runScan(projectPath: string): Promise<Result<ScanResult>> {
  const analysis = await analyzeProject(projectPath);
  if (!analysis.ok) {
    return err(`scan failed at stage 'analyze': ${analysis.error}`);
  }
  const stack = analysis.data;
  await saveStack(stack);

  const search = await searchTools(stack);
  if (!search.ok) {
    return err(`scan failed at stage 'search': ${search.error}`);
  }

  const persistTools = await saveTools(search.data.tools);
  if (!persistTools.ok) {
    return err(`scan failed at stage 'persist-tools': ${persistTools.error}`);
  }

  const recs = getRecommendationsByCategory(search.data.tools, stack);
  if (!recs.ok) {
    return err(`scan failed at stage 'recommend': ${recs.error}`);
  }

  const persistRecs = await saveRecommendations(recs.data);
  if (!persistRecs.ok) {
    return err(`scan failed at stage 'persist-recommendations': ${persistRecs.error}`);
  }

  return ok({
    stack,
    tools: search.data.tools,
    recommendations: recs.data,
    webSearchUnavailable: search.data.webSearchUnavailable,
  });
}
