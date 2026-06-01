# ToolHunt Scoring Rubric

The AI prompt uses this rubric to score every tool in the catalog against a
detected project stack. Score range is 0-100. The formula is identical to the
TypeScript implementation in `src/mcp/tools/recommend.ts` so the prompt and the
MCP server always agree.

## Formula

```
score = round(
  25 * stackMatch  +
  45 * categoryFit +
  18 * popularity  +
  12 * recency
)
```

All four inputs are in `[0, 1]`. `stackMatch` and `categoryFit` dominate: they
decide *whether* the tool fits. `popularity` and `recency` are tiebreakers that
favour proven, maintained projects.

---

## 1. `stackMatch` (weight 25)

How well the tool's metadata matches the detected stack. Computed by adding:

| Match                        | Weight |
|------------------------------|--------|
| `framework` appears in tool name/description | 0.40 |
| `language` appears in tool name/description  | 0.25 |
| `database` appears in tool name/description  | 0.20 |
| `infrastructure` appears in tool name/description | 0.10 |
| `project_type` token appears in tool name/description | 0.10 |
| **Maximum total**            | **1.05** (clamped to 1.0) |

Example: a TypeScript React tool with description "React hooks for the Vercel
AI SDK" on a `react` + `typescript` web app:
- framework `react` in text → +0.40
- language `typescript` in text → +0.25
- database none → +0
- infrastructure none → +0
- project_type `web-app` token "web" not in text → +0
- **stackMatch = 0.65**

## 2. `categoryFit` (weight 45 — the dominant factor)

```
categoryFit = categoryImportance[project_type][category] * coverageFactor
```

- `categoryImportance` comes from `data/stack-profiles.json` → `category_importance`
  and is in `[0, 1]`. The default for unlisted pairs is 0.6.
- `coverageFactor` is `1.0` if the category is in the project's
  `missing_categories`, else `0.4` (a tool for an already-served category is
  still useful but ranked lower).

This means a tool that fills a still-missing category for the project's type
will always outrank one that doesn't, even if the second tool is more popular.

## 3. `popularity` (weight 18)

| Source      | Computation |
|-------------|-------------|
| `stars` (GitHub) | `min(1, log10(stars + 1) / log10(100001))` — 100k stars ≈ 1.0 |
| `popularity_hint` (catalog) | `popularity_hint / 100` |
| Both absent | 0 |

When the catalog entry is hand-curated, use the catalog's
`popularity_hint` (0-100). When the AI is looking at a tool it knows from
its own knowledge, use the same log-stars approximation.

## 4. `recency` (weight 12)

```
ageDays = (today - last_updated) / 1 day
recency = max(0, 1 / (1 + ageDays / 180))
```

- 0 days → 1.00
- 90 days → 0.67
- 180 days → 0.50
- 365 days → 0.33
- 730 days → 0.20

If `last_updated` is unknown, treat as 0 (will lower the score).

---

## Worked example

A tool `ai` (Vercel AI SDK) on a `react` + `typescript` + `sqlite` Electron
web app with no existing AI tools.

- `stackMatch` ≈ 0.65 (framework react +0.40, language typescript +0.25)
- `categoryFit` = importance(`web-app`, `API Integrations`)=1.0 × coverage=1.0 = **1.0**
- `popularity` = log10(40000)/log10(100001) ≈ 0.91
- `recency` = 1/(1+5/180) ≈ 0.97

```
score = round(25*0.65 + 45*1.0 + 18*0.91 + 12*0.97)
      = round(16.25 + 45 + 16.38 + 11.64)
      = round(89.27) = 89
```

→ Top of the list. Correct.

## Anti-patterns to filter out

When ranking, drop or de-prioritise:

- Platform-binary npm packages (`@azure/mcp-linux-arm64`, etc.)
- Native CLI binary mirrors of a parent package
- Packages whose name does not appear in their description and vice versa
  (likely scraper noise)
- Packages older than 2 years with no recent release
- Packages with `popularity_hint` < 20 unless the project has no alternatives
