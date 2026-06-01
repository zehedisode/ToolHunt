import type { Result, StackProfile } from "../../types/index.js";
import { ok, err } from "../../types/index.js";
import { scanProject } from "../../analyzer/projectScanner.js";
import { detectStack } from "../../analyzer/stackDetector.js";

const ANALYZE_TIMEOUT_MS = 30000;

/**
 * Analyze a project at project_path and return a fully-populated Stack_Profile.
 * Bounded to 30 seconds; never throws.
 */
export async function analyzeProject(projectPath: string): Promise<Result<StackProfile>> {
  if (typeof projectPath !== "string" || projectPath.trim() === "") {
    return err("project_path is required and must be a non-empty string");
  }

  const timeout = new Promise<Result<StackProfile>>((resolve) => {
    setTimeout(
      () => resolve(err(`analyze_project timed out after ${ANALYZE_TIMEOUT_MS}ms`)),
      ANALYZE_TIMEOUT_MS,
    );
  });

  const work = (async (): Promise<Result<StackProfile>> => {
    try {
      const scan = await scanProject(projectPath);
      if (!scan.ok) {
        return err(scan.error);
      }
      const stack = detectStack(scan.data);
      return ok(stack);
    } catch (error) {
      return err(
        `analyze_project failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  })();

  return Promise.race([work, timeout]);
}
