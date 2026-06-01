# Requirements Document

## Introduction

ToolHunt is an MCP (Model Context Protocol) server that AI coding agents (Kiro, Claude Code, Cursor, OpenCode, and others) connect to. Once connected, ToolHunt analyzes the currently open project, searches multiple live sources in parallel for compatible AI tooling across nine categories, scores and ranks the results, and—on explicit user approval—installs selected tools into the project and updates the appropriate configuration files.

ToolHunt exposes four MCP tools (`analyze_project`, `search_tools`, `get_recommendations`, `install_tool`), a set of source connectors (mcp.so scraper, smithery.ai scraper, GitHub awesome-list fetcher, Tavily web search), and a local Express-served React web UI with a Connect page and a Dashboard page. The system is built with Node.js 20+ and TypeScript in strict mode, uses lowdb for local JSON storage, and enforces strict privacy and safety constraints around file access, configuration changes, and external network calls.

This document defines the functional and non-functional requirements for ToolHunt using EARS patterns and INCOSE quality rules.

## Glossary

- **ToolHunt**: The complete product, comprising the MCP server, source connectors, analyzer, installer, local web server, and web UI.
- **MCP_Server**: The Model Context Protocol server component that exposes ToolHunt tools to connected AI agents.
- **MCP_Tool**: One of the four callable operations exposed by the MCP_Server (`analyze_project`, `search_tools`, `get_recommendations`, `install_tool`).
- **Project_Analyzer**: The component that orchestrates project scanning and stack detection in response to `analyze_project`.
- **Project_Scanner**: The component that reads project files and directory structure to produce raw project data.
- **Stack_Detector**: The component that derives the structured Stack_Profile from raw project data.
- **Stack_Profile**: A JSON object describing the detected project, containing `language`, `framework`, `database`, `infrastructure`, `existing_tools`, `project_type`, and `missing_categories`.
- **Tool_Search_Engine**: The component that queries all enabled sources and aggregates discovered tools in response to `search_tools`.
- **Source_Connector**: A component that retrieves tool data from one external source (MCPSO_Scraper, Smithery_Scraper, GitHub_Source_Fetcher, or Web_Search_Client).
- **MCPSO_Scraper**: The Source_Connector that scrapes tool listings from mcp.so.
- **Smithery_Scraper**: The Source_Connector that scrapes tool listings from smithery.ai.
- **GitHub_Source_Fetcher**: The Source_Connector that fetches and parses the punkpeye and wong2 awesome-mcp-servers README files.
- **Web_Search_Client**: The Source_Connector that queries the Tavily web search API.
- **Tool_Record**: A discovered tool entry containing `name`, `description`, `source`, `url`, `install_command`, `category`, and `relevance_score`.
- **Tool_Category**: One of the nine categories: MCP Tools, Skills, Agents, Memory, Orchestrators, Context Windows, Prompt Templates, Logging and Telemetry, API Integrations.
- **Recommendation_Engine**: The component that scores and ranks Tool_Records in response to `get_recommendations`.
- **Relevance_Score**: An integer from 0 to 100 inclusive assigned to a Tool_Record by the Recommendation_Engine.
- **Tool_Installer**: The component that installs an approved tool and updates configuration files in response to `install_tool`.
- **MCP_Config_File**: An agent-specific MCP configuration file (`.kiro/mcp.json`, `.claude/mcp.json`, or `.cursor/mcp.json`).
- **Web_Server**: The Express.js server that serves the Web_UI and the REST_API.
- **REST_API**: The HTTP API exposed by the Web_Server for the Web_UI.
- **Web_UI**: The React + Vite + TailwindCSS dark-theme front end.
- **Connect_Page**: The Web_UI page where a user connects an agent to ToolHunt.
- **Dashboard_Page**: The Web_UI page that displays the Stack_Profile and tool recommendations.
- **Data_Store**: The lowdb JSON file used for local persistence of discovered tools and recommendations.
- **External_Call**: Any network request made to an external source (mcp.so, smithery.ai, GitHub, or Tavily).

## Requirements

### Requirement 1: Analyze Project Stack

**User Story:** As an AI coding agent, I want ToolHunt to analyze the currently open project, so that I can obtain a structured profile of the project's stack.

#### Acceptance Criteria

1. WHEN the `analyze_project` MCP_Tool is invoked with a valid `project_path`, THE Project_Analyzer SHALL produce a Stack_Profile in which the fields `language`, `framework`, `database`, `infrastructure`, `existing_tools`, `project_type`, and `missing_categories` are all present and non-null, where `existing_tools` and `missing_categories` are lists containing zero or more entries.
2. WHEN the Project_Scanner reads a project, THE Project_Scanner SHALL read `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `composer.json`, and `README.md` when each file is present in the project.
3. WHEN the Project_Scanner reads `README.md`, THE Project_Scanner SHALL read at most the first 100 lines of the file.
4. WHEN the Project_Scanner enumerates the directory structure, THE Project_Scanner SHALL traverse at most 3 levels of directory depth below the `project_path`.
5. IF a `project_path` does not exist or is not a readable directory, THEN THE Project_Analyzer SHALL return an error result that identifies the invalid `project_path` and SHALL NOT produce a Stack_Profile.
6. THE Stack_Detector SHALL set `language` to one of `"typescript"`, `"python"`, `"rust"`, `"go"`, or `"other"`.
7. WHERE no recognized manifest file is present in the project, THE Stack_Detector SHALL detect `language` from file extensions and directory structure heuristics.
8. IF the Stack_Detector cannot determine `language` from any manifest file or heuristic, THEN THE Stack_Detector SHALL set `language` to `"other"` and SHALL set `framework`, `database`, and `infrastructure` to `"none"`.
9. THE Stack_Detector SHALL populate `missing_categories` with the Tool_Categories for which no matching entry is found in `existing_tools`.
10. IF a manifest file is present but cannot be parsed, THEN THE Project_Scanner SHALL exclude that file from the raw project data and continue reading the remaining files.
11. WHEN the `analyze_project` MCP_Tool is invoked, THE Project_Analyzer SHALL return a Stack_Profile or an error result within 30 seconds of invocation.

### Requirement 2: Protect Environment Variable Values

**User Story:** As a developer, I want ToolHunt to never read the values of my environment variables, so that my secrets remain private.

#### Acceptance Criteria

1. WHEN the Project_Scanner encounters a file whose name follows the `.env` naming convention (including `.env`, `.env.local`, and `.env.production`), THE Project_Scanner SHALL extract only the variable key names, where a key name is the text preceding the first `=` character on a line with surrounding whitespace trimmed.
2. WHEN the Project_Scanner processes a `.env` file, THE Project_Scanner SHALL exclude every variable value (all text following the first `=` character on a line) from the raw project data, the Stack_Profile, the Data_Store, and any logs.
3. IF a line in a `.env` file contains no `=` character and is not empty after trimming, THEN THE Project_Scanner SHALL retain the trimmed line text as a key name.
4. IF a line in a `.env` file is empty or is a comment line, THEN THE Project_Scanner SHALL discard the line and extract no key from it.

### Requirement 3: Search Tool Sources in Parallel

**User Story:** As an AI coding agent, I want ToolHunt to search multiple live sources at once, so that I receive a broad and current set of candidate tools quickly.

#### Acceptance Criteria

1. WHEN the `search_tools` MCP_Tool is invoked with a Stack_Profile, THE Tool_Search_Engine SHALL query the MCPSO_Scraper, the Smithery_Scraper, the GitHub_Source_Fetcher, and the Web_Search_Client.
2. WHEN the Tool_Search_Engine queries the enabled Source_Connectors, THE Tool_Search_Engine SHALL issue the External_Calls to those Source_Connectors concurrently.
3. WHEN a Source_Connector returns results, THE Tool_Search_Engine SHALL convert each result into a Tool_Record containing `name`, `description`, `source`, `url`, `install_command`, `category`, and `relevance_score`.
4. IF a returned result is missing any of the fields `name`, `description`, `source`, `url`, `install_command`, or `category`, THEN THE Tool_Search_Engine SHALL discard the result and exclude it from the aggregated Tool_Records.
5. WHEN the Tool_Search_Engine aggregates Tool_Records from all Source_Connectors, THE Tool_Search_Engine SHALL return the combined set of Tool_Records.
6. IF one Source_Connector returns an error or fails to respond within its timeout, THEN THE Tool_Search_Engine SHALL exclude that Source_Connector's results and return the Tool_Records collected from the remaining Source_Connectors.
7. WHEN the GitHub_Source_Fetcher fetches awesome-list content, THE GitHub_Source_Fetcher SHALL fetch the punkpeye `awesome-mcp-servers` README and the wong2 `awesome-mcp-servers` README.
8. WHEN the GitHub_Source_Fetcher parses awesome-list content, THE GitHub_Source_Fetcher SHALL extract the tool name, description, GitHub URL, and Tool_Category from markdown tables and bullet lists.
9. WHEN the `search_tools` MCP_Tool is invoked with a Stack_Profile, THE Tool_Search_Engine SHALL return the aggregated Tool_Records within 15 seconds of invocation.
10. IF all Source_Connectors return errors or fail to respond within their timeouts, THEN THE Tool_Search_Engine SHALL return an empty set of Tool_Records.

### Requirement 4: Conditional Web Search

**User Story:** As a developer, I want ToolHunt to function without a Tavily API key, so that I can use ToolHunt with only the scraped sources when no key is configured.

#### Acceptance Criteria

1. IF the Tavily API key is not set (absent, empty, or containing only whitespace), THEN THE Tool_Search_Engine SHALL skip the Web_Search_Client and query only the MCPSO_Scraper, the Smithery_Scraper, and the GitHub_Source_Fetcher.
2. WHERE the Tavily API key is set, THE Tool_Search_Engine SHALL query the MCPSO_Scraper, the Smithery_Scraper, the GitHub_Source_Fetcher, and the Web_Search_Client.
3. WHERE the Tavily API key is set, THE Web_Search_Client SHALL query the Tavily API using search terms derived from the non-empty Stack_Profile fields among `framework`, `language`, and `project_type`.
4. WHERE the Tavily API key is set, THE Web_Search_Client SHALL return between 0 and 5 results per query.
5. WHERE the Tavily API key is set, IF the `framework`, `language`, and `project_type` Stack_Profile fields are all empty, THEN THE Tool_Search_Engine SHALL skip the Web_Search_Client and query only the MCPSO_Scraper, the Smithery_Scraper, and the GitHub_Source_Fetcher.
6. WHERE the Tavily API key is set, IF the Web_Search_Client query to the Tavily API fails or does not complete within 10 seconds, THEN THE Tool_Search_Engine SHALL return the results obtained from the MCPSO_Scraper, the Smithery_Scraper, and the GitHub_Source_Fetcher and SHALL indicate that web search results were unavailable.

### Requirement 5: External Call Timeouts and Fallback

**User Story:** As a developer, I want every external network call to time out predictably, so that ToolHunt remains responsive when a source is slow or unavailable.

#### Acceptance Criteria

1. IF an External_Call does not receive a response within 5 seconds of being issued, THEN THE Source_Connector SHALL abort the External_Call.
2. IF an External_Call is aborted because the 5 second timeout was exceeded, THEN THE Source_Connector SHALL return an empty result set for that source.
3. IF an External_Call returns a network error or a non-success status response, THEN THE Source_Connector SHALL return an empty result set for that source.
4. WHEN a Source_Connector returns an empty result set due to a timeout, a network error, or a non-success status, THE ToolHunt SHALL continue to aggregate and return results from all other sources without aborting the overall search.

### Requirement 6: Score and Rank Recommendations

**User Story:** As a developer, I want ToolHunt to score and rank discovered tools, so that I can see the most relevant tools first, grouped by category.

#### Acceptance Criteria

1. WHEN the `get_recommendations` MCP_Tool is invoked with a non-empty set of Tool_Records and a Stack_Profile, THE Recommendation_Engine SHALL assign each Tool_Record an integer Relevance_Score from 0 to 100 inclusive.
2. WHEN the Recommendation_Engine computes a Relevance_Score, THE Recommendation_Engine SHALL derive the score from the Tool_Record's stack match against the Stack_Profile, its Tool_Category coverage of the `missing_categories`, its popularity, and its recency, such that increasing any single one of these inputs while holding the others constant does not decrease the Relevance_Score, and a more recent last-update date yields a higher recency input.
3. WHEN the Recommendation_Engine returns recommendations, THE Recommendation_Engine SHALL group the Tool_Records by Tool_Category.
4. WHEN the Recommendation_Engine returns recommendations within a Tool_Category, THE Recommendation_Engine SHALL order the Tool_Records by Relevance_Score in descending order, breaking ties by descending popularity and then by ascending `name`.
5. WHERE a Tool_Record provides a GitHub star count, THE Recommendation_Engine SHALL use the star count as the popularity input to the Relevance_Score.
6. WHERE a Tool_Record provides no GitHub star count, THE Recommendation_Engine SHALL use a popularity input of 0 for that Tool_Record.
7. WHEN the Recommendation_Engine returns recommendations, THE Recommendation_Engine SHALL return at most 10 Tool_Records in total.
8. WHEN the `get_recommendations` MCP_Tool is invoked with an empty set of Tool_Records, THE Recommendation_Engine SHALL return an empty set of recommendations without error.

### Requirement 7: Install Approved Tools

**User Story:** As a developer, I want ToolHunt to install a tool I approved and update the right configuration file, so that the tool is ready to use without manual setup.

#### Acceptance Criteria

1. WHEN the `install_tool` MCP_Tool is invoked with valid `tool_name`, `install_command`, `project_path`, and `config_type`, THE Tool_Installer SHALL execute the `install_command` within the `project_path`.
2. WHERE `config_type` is `mcp_json`, THE Tool_Installer SHALL add a server entry for the tool to the agent-specific MCP_Config_File.
3. WHERE `config_type` is `package_json`, THE Tool_Installer SHALL add the tool entry to the `package.json` scripts.
4. WHEN the `install_command` exits with a zero status and the required configuration update completes, THE Tool_Installer SHALL return a success result that includes the execution logs.
5. IF the `install_command` exits with a non-zero status, THEN THE Tool_Installer SHALL return a failure result that includes the captured error output and SHALL NOT record the tool in the Data_Store.
6. WHEN both the installation and the configuration update complete successfully, THE Tool_Installer SHALL record the installed tool in the Data_Store.
7. IF the `install_tool` MCP_Tool is invoked with a missing required parameter, an unsupported `config_type`, or a `project_path` that does not exist, THEN THE Tool_Installer SHALL return an error result and SHALL NOT execute the `install_command`.
8. IF the `install_command` does not complete within 300 seconds, THEN THE Tool_Installer SHALL abort the installation and return a failure result indicating the timeout.
9. IF the `install_command` succeeds but the configuration update fails, THEN THE Tool_Installer SHALL return a failure result that identifies the configuration update failure and SHALL NOT record the tool in the Data_Store.

### Requirement 8: Protect Existing Files and Configuration

**User Story:** As a developer, I want ToolHunt to never delete my files or silently overwrite my configuration, so that my project stays intact and under my control.

#### Acceptance Criteria

1. THE Tool_Installer SHALL leave every pre-existing project file that it does not explicitly modify byte-for-byte unchanged during every installation, including during creation of a new MCP_Config_File.
2. IF an installation would delete an existing project file, THEN THE Tool_Installer SHALL halt the operation and request user confirmation before removing any file, leaving the targeted file unchanged until confirmation is received.
3. IF an installation would overwrite an existing MCP_Config_File entry, THEN THE Tool_Installer SHALL halt the operation and request user confirmation before modifying any entry, leaving the targeted entry unchanged until confirmation is received.
4. WHERE an MCP_Config_File does not already exist, THE Tool_Installer SHALL create the MCP_Config_File and add the server entry without requesting confirmation.
5. IF file retention cannot be guaranteed during an installation, THEN THE Tool_Installer SHALL halt the operation immediately, report an error indicating which files were and were not modified, and make no further file modifications.
6. IF the user declines a requested confirmation to delete a file or overwrite an MCP_Config_File entry, THEN THE Tool_Installer SHALL abort the operation and leave the targeted file or entry unchanged.
7. IF the user grants a requested confirmation to delete a file or overwrite an MCP_Config_File entry, THEN THE Tool_Installer SHALL proceed with the confirmed operation.

### Requirement 9: MCP Server Exposure

**User Story:** As an AI coding agent, I want to connect to ToolHunt over MCP, so that I can invoke its tools from within my IDE.

#### Acceptance Criteria

1. WHEN the MCP_Server starts, THE MCP_Server SHALL register exactly the four MCP_Tools `analyze_project`, `search_tools`, `get_recommendations`, and `install_tool`, and no other MCP_Tools.
2. WHEN a connected agent requests the tool list, THE MCP_Server SHALL return the four registered MCP_Tools, each with its input schema, within 2 seconds.
3. IF an MCP_Tool is invoked with input that does not match its declared schema, THEN THE MCP_Server SHALL reject the invocation without executing the MCP_Tool, leaving system state unchanged, and SHALL return a validation error that identifies the name of the first invalid input field.
4. IF the MCP_Server cannot determine which part of the input is invalid, THEN THE MCP_Server SHALL return a generic validation error indicating that the input failed schema validation.
5. IF one or more of the four MCP_Tools fails to register during startup, THEN THE MCP_Server SHALL return a startup error that identifies each MCP_Tool that failed to register and SHALL NOT accept agent connections.

### Requirement 10: Local Web Server and REST API

**User Story:** As a developer, I want a local web server that serves the ToolHunt UI and API, so that I can drive the setup and review recommendations from a browser.

#### Acceptance Criteria

1. WHEN the Web_Server starts, THE Web_Server SHALL bind to port 3847.
2. IF port 3847 is occupied, THEN THE Web_Server SHALL attempt to bind to port 3848.
3. IF port 3847 and port 3848 are both occupied, THEN THE Web_Server SHALL attempt to bind to port 3849.
4. IF port 3847, port 3848, and port 3849 are all occupied, THEN THE Web_Server SHALL exit with an error message that reports the unavailable ports.
5. THE REST_API SHALL expose the endpoints `GET /api/status`, `POST /api/scan`, `GET /api/recommendations`, `POST /api/install`, and `GET /api/tools`.
6. WHEN `GET /api/status` is requested, THE REST_API SHALL return, within 2 seconds, the Web_Server health as one of `healthy` or `unhealthy` and the MCP connection status as one of `connected` or `disconnected`.
7. WHEN `POST /api/scan` is requested, THE REST_API SHALL trigger project analysis, tool search, and recommendation generation and return an acknowledgment that the scan was triggered.
8. WHEN `GET /api/recommendations` is requested, THE REST_API SHALL return the recommendations stored in the Data_Store.
9. WHEN `POST /api/install` is requested with a valid tool selection, THE REST_API SHALL invoke the Tool_Installer for the selected tool and return the installation outcome as one of `succeeded` or `failed`.
10. IF a stage of the `POST /api/scan` operation fails, THEN THE REST_API SHALL return an error identifying the failed stage and SHALL retain the recommendations previously stored in the Data_Store.
11. WHEN `GET /api/recommendations` or `GET /api/tools` is requested and the Data_Store is empty, THE REST_API SHALL return an empty list.
12. IF `POST /api/install` is requested with a missing or invalid tool selection, THEN THE REST_API SHALL return an error and SHALL NOT invoke the Tool_Installer.

### Requirement 11: Connect Page

**User Story:** As a developer, I want a Connect page with per-agent setup instructions, so that I can wire ToolHunt into my chosen agent quickly.

#### Acceptance Criteria

1. THE Connect_Page SHALL present exactly five agent selector tabs labeled Kiro, Claude Code, Cursor, OpenCode, and Any Agent, with exactly one tab selected at any time and the Kiro tab selected by default on initial load.
2. WHEN a user selects an agent tab, THE Connect_Page SHALL display the MCP configuration instructions for the selected agent within 1 second and visually mark the selected tab as active.
3. WHEN a user activates the copy setup prompt control, THE Connect_Page SHALL copy the complete setup prompt text for the currently selected agent to the clipboard and display a copied confirmation indicator within 1 second.
4. IF the clipboard write fails when a user activates the copy setup prompt control, THEN THE Connect_Page SHALL display an error indication that the copy did not succeed and retain the displayed setup prompt text so the user can copy it manually.
5. WHERE a user expands the view prompt section, THE Connect_Page SHALL display the raw MCP configuration JSON for the currently selected agent.
6. WHILE the MCP_Server connection is not detected, THE Connect_Page SHALL re-check the connection status at intervals not exceeding 5 seconds and display a not-connected indicator.
7. WHEN the MCP_Server connection is detected, THE Connect_Page SHALL display a setup-complete confirmation containing a success indicator within 5 seconds of the connection being established.

### Requirement 12: Dashboard Page

**User Story:** As a developer, I want a Dashboard that shows my project stack and recommended tools by category, so that I can review and install tools in one place.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL display the project name and a stack badge for each Stack_Profile field whose value is neither empty nor `"none"`.
2. THE Dashboard_Page SHALL display a section for each of the nine Tool_Categories.
3. WHEN one or more recommendations are available for a Tool_Category, THE Dashboard_Page SHALL display a tool card for each Tool_Record showing its `name`, `description`, a source badge derived from its `source`, and its Relevance_Score from 0 to 100.
4. WHEN a user activates the scan control, THE Dashboard_Page SHALL trigger the `POST /api/scan` request.
5. WHEN a user activates a tool card install control, THE Dashboard_Page SHALL trigger the `POST /api/install` request for that Tool_Record.
6. WHILE an installation triggered from a tool card is in progress, THE Dashboard_Page SHALL display an installation progress indicator on the corresponding tool card.
7. WHEN a tool installation succeeds, THE Dashboard_Page SHALL display an installed indicator on the corresponding tool card.
8. IF a tool installation fails, THEN THE Dashboard_Page SHALL display a failure indicator and an error indication on the corresponding tool card.
9. IF a `POST /api/scan` request fails, THEN THE Dashboard_Page SHALL display an error indication and retain the previously displayed recommendations.

### Requirement 13: TypeScript Strict Mode and Async Error Handling

**User Story:** As a maintainer, I want strict typing and consistent async error handling, so that the codebase stays reliable and predictable.

#### Acceptance Criteria

1. THE ToolHunt codebase SHALL compile with TypeScript strict mode enabled and report zero type errors during compilation.
2. WHEN an async function performs an operation that can reject or throw (such as I/O, network, file system, or external service calls), THE async function SHALL execute that operation within a try/catch block.
3. IF an async function catches an error, THEN THE async function SHALL return a structured error result that indicates a failure status and includes a description of the error, without re-throwing or leaving the promise rejection unhandled.
4. WHEN an async function completes its operation successfully, THE async function SHALL return a structured result that indicates a success status.

### Requirement 14: Local Persistence

**User Story:** As a developer, I want discovered tools and recommendations stored locally, so that the Dashboard can display results without re-running every search.

#### Acceptance Criteria

1. WHEN the Tool_Search_Engine produces Tool_Records, THE ToolHunt SHALL persist the produced Tool_Records to the Data_Store, replacing any Tool_Records previously stored from an earlier search.
2. WHEN the Recommendation_Engine produces ranked recommendations, THE ToolHunt SHALL persist the produced recommendations to the Data_Store, replacing any recommendations previously stored from an earlier search.
3. WHEN `GET /api/tools` is requested, THE REST_API SHALL return the Tool_Records stored in the Data_Store.
4. WHEN `GET /api/tools` is requested and the Data_Store contains no Tool_Records, THE REST_API SHALL return an empty collection.
5. IF a write to the Data_Store fails while persisting Tool_Records or recommendations, THEN THE ToolHunt SHALL return an error result indicating the persistence failure and SHALL retain the data previously stored in the Data_Store.

### Requirement 15: Project Deliverables

**User Story:** As a new user, I want clear setup documentation and a setup script, so that I can install and connect ToolHunt without prior knowledge of the codebase.

#### Acceptance Criteria

1. THE ToolHunt SHALL provide a `README.md` file that contains a valid MCP configuration entry for Kiro and a valid MCP configuration entry for Claude Code, where each entry specifies the command and the arguments required to launch the ToolHunt MCP server.
2. THE ToolHunt SHALL provide a `README.md` file that documents the three quick install commands in execution order and lists all nine Tool_Categories by name.
3. THE ToolHunt SHALL provide an `AGENT_SETUP.md` file containing a universal install prompt that includes, without reference to any other document, the Node.js version prerequisite check, the install and build commands, the MCP configuration entry, and a setup verification step.
4. WHEN the setup script is executed, THE ToolHunt SHALL install project dependencies, build the MCP server, and build the Web_UI.
5. IF a step of the setup script fails (dependency installation, MCP server build, or Web_UI build), THEN THE ToolHunt SHALL halt execution and output an error indication identifying the failed step.
6. WHEN the setup script completes all steps successfully, THE ToolHunt SHALL output a success confirmation and the URL for opening the Web_UI.
