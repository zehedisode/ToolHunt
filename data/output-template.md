# ToolHunt Output Template

The AI prompt instructs the model to return *exactly* this structure. The
report is the user-facing deliverable; it should be copy-pasteable into a
GitHub issue, PR description, or Notion page.

```markdown
# 🎣 ToolHunt Report — {project_name}

**Generated:** {date}
**Stack detected:** {language} + {framework} + {database} on {infrastructure}
**Project type:** {project_type}
**Existing AI tools:** {comma-separated, or "none"}
**Missing categories:** {count} of 9

---

## TL;DR — Top 3 picks

1. **{tool_name}** ({category}, score {0-100}) — {one-sentence why}
2. **{tool_name}** ({category}, score {0-100}) — {one-sentence why}
3. **{tool_name}** ({category}, score {0-100}) — {one-sentence why}

## Stack summary

| Field          | Value                              |
|----------------|------------------------------------|
| Language       | {language}                         |
| Framework      | {framework}                        |
| Database       | {database}                         |
| Infrastructure | {infrastructure}                   |
| Project type   | {project_type}                     |
| Existing tools | {existing_tools}                   |

## Recommendations by category

For each missing category with `categoryImportance ≥ 0.5` for the project type,
list the top 1-2 tools. Skip the rest with a one-line reason.

**Source badges:** every tool must show where it came from:
- `curated` — found in `data/catalog.json`
- `live-search` — discovered via your web tools in step 4 (hybrid mode)
- `model-knowledge` — recalled from your training data (no live search)

### {Category} (importance {0.00-1.00}, {missing|covered})

- **{name}** — score {0-100} `[{source}]`
  - Why: {concrete fit reason for this specific project}
  - Install: `{install_command}` *(omit if you don't have a verified command)*
  - Link: {url} *(omit if you don't have a verified URL)*

- **{tool_name}** — score {0-100}
  - Why: ...
  - Install: ...

### {Category 2} ...

### Categories skipped (with reason)
- **{Category X}** — {reason, e.g. "Vector DB not needed; project has no RAG workload"}

## What I deliberately did NOT recommend

- **{tool_name}** — {why it scored high but is wrong for this project}
- **{tool_name}** — {e.g. "deprecated since 2024, low maintenance"}

## Next steps

1. {concrete first action, e.g. "Install @ai-sdk/react and wire it to a /api/chat route"}
2. {second action}
3. {third action}

## Data used

- Catalog version: {catalog.version}
- Generated at: {catalog.generated_at}
- Source file: {catalog URL or path}
- Scoring rubric: data/scoring-rubric.md
```

## Rules for the AI filling the template

1. **Be specific, not generic.** "Install langchain" is bad; "Install
   @langchain/core to add a tool-calling loop to the existing whatsapp-service.js"
   is good.
2. **Score everything you show.** Never recommend without a score.
3. **Show your anti-picks.** A list of "what I considered and rejected" makes
   the report credible.
4. **Skip categories with a reason.** Don't list 9 categories if only 3 apply.
5. **Never hallucinate tools.** If the catalog doesn't have a tool, the AI
   may use its own knowledge but must label it as `source: model-knowledge`
   and explain the fit without a numeric popularity/recency score.
6. **Output ONLY the report.** No preamble, no "here is your report". Start
   with the `# 🎣 ToolHunt Report` header.
