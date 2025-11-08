# Requirements Document

## Introduction

The Codebase Onboarding Agent is a web-based interactive system that helps developers understand new codebases through AI-powered analysis, visualization, and voice-guided walkthroughs. The system analyzes GitHub repositories, explains architecture decisions, traces data flow, and generates onboarding materials including text documentation, animated visualizations, and voice-based interactive sessions. It integrates with GitHub for repository access, Airia as the enterprise agent control plane for governance and multi-LLM orchestration, OpenRouter for AI model access, Agentuity for agent workflow execution, Modal for animation generation, and Retell AI for real-time voice interactions. All onboarding sessions can be replayed as interactive scripts for team standardization and iterative improvement.

## Glossary

- **System**: The Codebase Onboarding Agent web application
- **Developer**: A user who analyzes codebases and interacts with onboarding sessions with full access to their own sessions
- **Collaborator**: A user invited to view or interact with another user's onboarding session with limited permissions
- **Team Lead**: A user with privileges to create and share templates, view team analytics, and manage team member access
- **Administrator**: A user with elevated privileges who manages system configuration, policies, and monitors usage across tenants
- **Repository**: A GitHub code repository to be analyzed
- **Analysis Scope**: The specific files, folders, or entire repository selected for analysis
- **Onboarding Session**: A single interactive walkthrough of a codebase with persisted state
- **Animation Output**: Video visualizations generated via Modal with defined duration and resolution limits
- **Text Output**: Formatted markdown documentation with explanations and navigation links
- **GitHub Integration**: OAuth-based connection to user's GitHub account with minimal required scopes
- **AI Model**: Language model selected from OpenRouter's available models
- **OpenRouter**: API service providing access to multiple AI models
- **Agentuity**: Agent orchestration framework for managing analysis workflow (integrated with Airia)
- **Airia**: Enterprise agent control plane providing governance, multi-LLM routing, data connectors, risk guardrails, and per-tenant policies
- **Agent Flow**: Versioned workflow definition managed by Airia for analysis and code execution
- **Retell AI**: Real-time voice interaction platform enabling voice-based onboarding sessions
- **Voice Session**: Audio-based onboarding interaction synchronized with terminal UI and visual outputs
- **Barge-in**: Capability for users to interrupt voice agent mid-response
- **Voice Timeline**: Temporal record of voice interactions linked to code locations and analysis steps
- **Interactive Script**: Replayable recording of an onboarding session including sanitized explanations, diagrams, and voice timeline without raw code
- **Sanitized Artifact**: Output that contains explanations and references but excludes raw repository code, secrets, and PII
- **Audio Retention Policy**: Tenant-configurable rules for voice recording storage duration
- **Transcript Retention Policy**: Tenant-configurable rules for voice transcript storage duration separate from audio
- **Intermediate Artifact**: Temporary data including embeddings, diagram inputs, and cached analysis results
- **RBAC**: Role-Based Access Control defining permissions for Developer, Collaborator, Team Lead, and Administrator roles
- **SSO**: Single Sign-On authentication via OIDC protocol
- **MFA**: Multi-Factor Authentication for enhanced security
- **Agent Policy**: Airia-enforced rules governing agent behavior, model selection, and data access
- **Multi-LLM Routing**: Airia capability to dynamically select optimal models based on task and policy
- **Modal**: Cloud platform for generating animation videos
- **Learning Profile**: Persisted user-specific data tracking understood concepts and preferences across sessions
- **Access Token**: Short-lived encrypted credential for GitHub API access
- **Sandbox Environment**: Isolated execution environment for running code examples
- **Session Cost**: Total API usage cost incurred during an onboarding session
- **Tenant**: Isolated user account with dedicated data storage and access controls
- **AST**: Abstract Syntax Tree representation of source code
- **Fallback Analysis**: Alternative analysis method when AST parsing is unavailable

## Requirements

### Requirement 1

**User Story:** As a developer, I want to link my GitHub account to the system with minimal permissions, so that I can access my repositories securely

#### Acceptance Criteria

1. THE System SHALL provide a GitHub OAuth authentication flow requesting only read-only repository access scope
2. WHEN the Developer completes GitHub authentication, THE System SHALL encrypt the Access Token using AES-256 encryption
3. THE System SHALL generate short-lived Access Tokens with a maximum lifetime of 8 hours
4. THE System SHALL refresh Access Tokens automatically before expiration
5. IF GitHub authentication fails, THEN THE System SHALL display an error message with retry option and log the failure for audit
6. THE System SHALL allow the Developer to disconnect their GitHub account and delete all stored tokens
7. THE System SHALL store Access Tokens separately from user profile data with tenant isolation

### Requirement 2

**User Story:** As a developer, I want to select a repository for analysis with search and filtering capabilities, so that I can efficiently find and analyze any codebase

#### Acceptance Criteria

1. WHERE the Developer has linked their GitHub account, THE System SHALL display paginated lists of accessible repositories with 50 repositories per page
2. THE System SHALL provide search functionality to filter repositories by name or description
3. THE System SHALL accept a GitHub repository URL as input for public repositories
4. WHEN the Developer selects a repository, THE System SHALL validate repository accessibility with retry logic for transient failures
5. THE System SHALL display repository metadata including name, description, primary language, size, and submodule information
6. THE System SHALL support monorepo analysis by allowing selection of specific subdirectories as root
7. IF a repository contains submodules, THEN THE System SHALL allow the Developer to include or exclude submodules from analysis
8. IF GitHub API rate limits are reached, THEN THE System SHALL display remaining quota and estimated reset time

### Requirement 3

**User Story:** As a developer, I want to choose specific files or folders to analyze with clear scope limits, so that I can focus on relevant parts while managing costs

#### Acceptance Criteria

1. WHEN a repository is selected, THE System SHALL display the repository's file tree structure with file sizes
2. THE System SHALL allow the Developer to select individual files for analysis
3. THE System SHALL allow the Developer to select entire folders for analysis
4. THE System SHALL provide an option to analyze the entire repository up to 100MB total size
5. THE System SHALL display the total size, file count, and estimated Session Cost of the selected Analysis Scope
6. IF the selected Analysis Scope exceeds 100MB, THEN THE System SHALL prompt the Developer to reduce scope
7. THE System SHALL exclude binary files, generated files, and dependency directories by default with option to include

### Requirement 4

**User Story:** As a developer, I want to select which AI model to use with clear pricing and capability information, so that I can make informed decisions about cost and quality

#### Acceptance Criteria

1. THE System SHALL retrieve available models from OpenRouter API with retry logic for up to 3 attempts
2. THE System SHALL display model options with metadata including name, provider, pricing per token, context window size, and inference modes
3. THE System SHALL allow the Developer to select one AI Model for the Onboarding Session
4. WHEN no model is selected, THE System SHALL use a default recommended model with balanced cost and performance
5. THE System SHALL validate the selected model's availability before starting analysis
6. IF the selected model becomes unavailable during analysis, THEN THE System SHALL automatically switch to a backup model and notify the Developer
7. THE System SHALL display estimated total cost based on Analysis Scope and selected model before starting
8. IF OpenRouter API is unreachable, THEN THE System SHALL retry with exponential backoff up to 60 seconds total

### Requirement 5

**User Story:** As a developer, I want to choose between animation video output or text-based documentation with clear specifications, so that I can get reproducible onboarding materials

#### Acceptance Criteria

1. THE System SHALL provide output format options including animation and text-based formats
2. THE System SHALL allow the Developer to select animation output with video visualization at 1080p resolution and maximum 10 minute duration
3. THE System SHALL allow the Developer to select text output with markdown formatting and embedded diagrams
4. WHEN animation output is selected, THE System SHALL use Modal for video generation with retry logic for up to 2 attempts
5. WHEN text output is selected, THE System SHALL generate formatted markdown documentation with linked table of contents
6. THE System SHALL generate downloadable bundles containing all output artifacts including diagrams and sanitized code references
7. IF animation generation fails, THEN THE System SHALL fallback to static diagram generation and notify the Developer
9. THE System SHALL limit animation generation to 5 minutes processing time before fallback

### Requirement 6

**User Story:** As a developer, I want the agent to analyze multi-language codebases and explain architecture decisions, so that I can understand the high-level design

#### Acceptance Criteria

1. THE System SHALL parse the selected Analysis Scope using AST parsing for supported languages including JavaScript, TypeScript, Python, Java, Go, Rust, and C++
2. WHERE AST parsing is unavailable for a file type, THE System SHALL use Fallback Analysis with pattern matching and heuristics
3. THE System SHALL identify architectural patterns within the codebase including MVC, microservices, layered architecture, and event-driven patterns
4. THE System SHALL generate explanations for identified architecture decisions with references to specific code locations
5. THE System SHALL analyze Git history with configurable branch selection and maximum depth of 100 commits
6. THE System SHALL present architecture explanations in the selected output format with navigable section links
7. IF Git history analysis exceeds 30 seconds, THEN THE System SHALL limit depth and continue with available data

### Requirement 7

**User Story:** As a developer, I want the agent to show me where key features are implemented, so that I can quickly locate relevant code

#### Acceptance Criteria

1. THE System SHALL identify feature implementations within the Analysis Scope
2. THE System SHALL map features to specific files and code locations
3. THE System SHALL provide file paths and line number references for each feature
4. THE System SHALL organize features by functional area or module
5. THE System SHALL include code snippets demonstrating feature implementations

### Requirement 8

**User Story:** As a developer, I want the agent to trace data flow through the application with defined limits, so that I can understand how information moves through the system

#### Acceptance Criteria

1. THE System SHALL identify data entry points in the codebase including API endpoints, event handlers, and main functions
2. THE System SHALL trace data transformations through function calls and modules up to 10 levels deep
3. THE System SHALL identify data storage and retrieval patterns including database operations and file I/O
4. THE System SHALL generate visual or textual representations of data flow paths with Mermaid diagrams
5. THE System SHALL highlight key data structures and their relationships
6. IF data flow tracing exceeds 10 levels, THEN THE System SHALL truncate with indication of additional depth
7. THE System SHALL limit data flow analysis to 60 seconds per entry point before moving to next

### Requirement 9

**User Story:** As a developer, I want the agent to run code examples in a secure sandbox, so that I can see actual behavior without security risks

#### Acceptance Criteria

1. THE System SHALL execute code examples in a Sandbox Environment with no network access
2. THE System SHALL limit Sandbox Environment memory to 512MB and CPU to 1 core
3. THE System SHALL capture execution outputs including console logs and return values
4. THE System SHALL include execution results in the onboarding materials
5. IF code execution fails, THEN THE System SHALL capture and display error information with stack traces
6. THE System SHALL limit execution time to 5 seconds per code example
7. THE System SHALL isolate each code execution in a separate container with no shared state
8. THE System SHALL prevent file system access outside of a temporary working directory
9. IF Sandbox Environment creation fails, THEN THE System SHALL skip code execution and continue with static analysis

### Requirement 10

**User Story:** As a developer, I want the system to remember what I've learned across sessions with privacy controls, so that it can provide personalized guidance

#### Acceptance Criteria

1. THE System SHALL track which sections the Developer has reviewed during the Onboarding Session
2. THE System SHALL allow the Developer to mark concepts as understood or confusing
3. THE System SHALL adjust subsequent explanations based on Developer feedback
4. THE System SHALL provide additional detail for concepts marked as confusing
5. THE System SHALL persist Developer progress in a Learning Profile across multiple Onboarding Sessions
6. THE System SHALL store Learning Profile data with Tenant isolation
7. THE System SHALL allow the Developer to opt-out of Learning Profile persistence
8. THE System SHALL allow the Developer to export their Learning Profile data in JSON format
9. THE System SHALL allow the Developer to delete their Learning Profile data permanently
10. THE System SHALL not include code snippets or repository content in Learning Profile data to protect confidentiality

### Requirement 11

**User Story:** As a developer, I want the system to have a minimalistic UI with a theme matching the technical nature of code analysis, so that I have a focused and professional experience

#### Acceptance Criteria

1. THE System SHALL implement a minimalistic user interface design
2. THE System SHALL use a color scheme appropriate for developer tools
3. THE System SHALL provide clear visual hierarchy for navigation and content
4. THE System SHALL ensure responsive design for different screen sizes
5. THE System SHALL maintain consistent styling across all pages and components

### Requirement 12

**User Story:** As a developer, I want to interact with the agent through an accessible terminal-like UI, so that I have a familiar and efficient interface

#### Acceptance Criteria

1. THE System SHALL provide an interactive terminal UI component with WCAG 2.1 Level AA compliance
2. THE System SHALL accept text commands and queries from the Developer
3. THE System SHALL display agent responses in the terminal interface with syntax highlighting
4. THE System SHALL support command history navigation using up and down arrow keys
5. THE System SHALL provide command suggestions and autocomplete with tab key
6. THE System SHALL support keyboard shortcuts for common actions including clear, copy, and help
7. THE System SHALL provide a command palette accessible via Ctrl+K or Cmd+K
8. THE System SHALL display help documentation with command grammar and examples
9. THE System SHALL support screen reader navigation with proper ARIA labels
10. THE System SHALL maintain command history for the duration of the Onboarding Session

### Requirement 13

**User Story:** As an administrator, I want the application to securely manage API keys for all integrated services across environments, so that services can be accessed without exposing credentials

#### Acceptance Criteria

1. THE System SHALL store API keys for GitHub, OpenRouter, Airia, Agentuity, Modal, and Retell AI in environment variables with support for multiple deployment environments
2. THE System SHALL validate API keys before making service requests
3. THE System SHALL handle API authentication errors gracefully with retry logic
4. IF an API key is invalid, THEN THE System SHALL display an appropriate error message and log the failure for audit
5. THE System SHALL never expose API keys in client-side code, responses, logs, or voice transcripts
6. THE System SHALL support configuration deployment via environment-specific config files
7. THE System SHALL encrypt API keys at rest using AES-256 encryption
8. THE System SHALL rotate API keys without service interruption when new keys are provided
9. THE System SHALL use Airia data connectors for secure credential management where supported


### Requirement 14

**User Story:** As a developer, I want the system to respond quickly and handle high throughput, so that I can analyze codebases efficiently

#### Acceptance Criteria

1. THE System SHALL respond to user interactions within 200 milliseconds for UI operations
2. THE System SHALL initiate analysis within 2 seconds of receiving an analysis request
3. THE System SHALL support at least 100 concurrent Onboarding Sessions
4. THE System SHALL process repository file tree requests within 3 seconds for repositories up to 10000 files
5. THE System SHALL stream analysis results progressively rather than waiting for complete analysis
6. IF response time exceeds targets, THEN THE System SHALL display a loading indicator with progress information
7. THE System SHALL cache repository metadata for 1 hour to reduce GitHub API calls

### Requirement 15

**User Story:** As an administrator, I want comprehensive observability into system operations, so that I can monitor health and diagnose issues

#### Acceptance Criteria

1. THE System SHALL emit structured logs for all API requests including timestamp, user ID, endpoint, and response time
2. THE System SHALL track metrics including request latency, error rates, and API usage by service
3. THE System SHALL provide a health check endpoint returning system status and dependency availability
4. THE System SHALL log all authentication events including successes and failures
5. THE System SHALL emit alerts when error rates exceed 5 percent over a 5 minute window
6. THE System SHALL track Session Cost per user and per Onboarding Session
7. THE System SHALL provide dashboards displaying key metrics including active sessions, API usage, and costs
8. THE System SHALL retain logs for 90 days with secure storage

### Requirement 16

**User Story:** As an administrator, I want to enforce unified cost limits across all session types, so that I can control operational expenses consistently

#### Acceptance Criteria

1. THE System SHALL calculate estimated Session Cost before starting any Onboarding Session including text-based and Voice Sessions
2. THE System SHALL enforce a maximum Session Cost of 5 dollars per Onboarding Session by default
3. THE System SHALL allow Administrators to configure maximum Session Cost per Tenant
4. IF estimated Session Cost exceeds the limit, THEN THE System SHALL prompt the Developer to reduce Analysis Scope
5. THE System SHALL track actual Session Cost during analysis including LLM, voice, and animation costs
6. THE System SHALL display cumulative Session Cost to the Developer in real-time via UI and voice notifications
7. IF actual Session Cost approaches 90 percent of the limit, THEN THE System SHALL warn the Developer and offer to pause analysis
8. THE System SHALL terminate analysis automatically if Session Cost reaches the maximum limit
9. THE System SHALL apply the same cost limits and tracking to Voice Sessions as text-based sessions
10. THE System SHALL include Retell AI usage costs in Session Cost calculations
11. THE System SHALL honor tenant-level cost caps for all features including voice with automatic session termination at limit

### Requirement 17

**User Story:** As a developer, I want to invite collaborators to view my onboarding session, so that we can learn together

#### Acceptance Criteria

1. THE System SHALL allow the Developer to generate a shareable link for an Onboarding Session
2. THE System SHALL allow the Developer to set permissions for Collaborators including view-only or interactive access
3. WHEN a Collaborator accesses a shared session, THE System SHALL authenticate the Collaborator
4. THE System SHALL display Collaborator presence indicators showing who is viewing the session
5. THE System SHALL allow the Developer to revoke Collaborator access at any time
6. THE System SHALL enforce Tenant isolation ensuring Collaborators cannot access other sessions
7. THE System SHALL log all Collaborator access events for audit

### Requirement 18

**User Story:** As a developer, I want my repository code to remain confidential with explicit data flow controls, so that proprietary information is protected

#### Acceptance Criteria

1. THE System SHALL not store raw repository source code beyond the duration of the Onboarding Session
2. THE System SHALL delete all raw repository data and Intermediate Artifacts within 24 hours of session completion
3. THE System SHALL transmit repository code to LLM services only via Airia's policy engine with sensitive-data masking
4. THE System SHALL transmit summarized context to Retell AI without raw repository code
5. THE System SHALL transmit code snippets to Modal only for diagram generation with automatic deletion after rendering
6. THE System SHALL not transmit repository code to OpenRouter directly, only through Airia routing
7. THE System SHALL encrypt repository data in transit using TLS 1.3
8. THE System SHALL encrypt repository data at rest using AES-256 encryption
9. THE System SHALL not include repository code in logs, error messages, or voice transcripts
10. THE System SHALL allow the Developer to delete all session data immediately upon request
11. THE System SHALL not use repository code for model training or system improvement without explicit consent
12. THE System SHALL generate Interactive Scripts as Sanitized Artifacts without raw code or secrets

### Requirement 19

**User Story:** As an administrator, I want comprehensive audit logs with redacted sensitive data for compliance, so that I can track all system access while protecting confidentiality

#### Acceptance Criteria

1. THE System SHALL log all authentication events with timestamp, user ID, IP address, and outcome
2. THE System SHALL log all repository access events including repository name and Analysis Scope size without code content
3. THE System SHALL log all API calls to external services with redacted request and response metadata
4. THE System SHALL log all data deletion events including what was deleted and by whom
5. THE System SHALL log all permission changes for Collaborator access
6. THE System SHALL store Agent Flow traces with redacted inputs and outputs excluding repository code
7. THE System SHALL log Airia policy enforcement events including violations and fallbacks
8. THE System SHALL log Retell AI session events including duration and participant count without voice content
9. THE System SHALL store audit logs in append-only storage with tamper detection
10. THE System SHALL retain audit logs for 2 years
11. THE System SHALL provide audit log export functionality for compliance reporting
12. THE System SHALL redact all repository code, secrets, and PII from audit logs while preserving governance metadata

### Requirement 20

**User Story:** As an administrator, I want robust error handling for all third-party API integrations including Airia and Retell, so that transient failures don't disrupt user experience

#### Acceptance Criteria

1. THE System SHALL implement exponential backoff retry logic for all GitHub API calls with maximum 3 attempts
2. THE System SHALL implement exponential backoff retry logic for all Airia API calls with maximum 3 attempts
3. THE System SHALL implement exponential backoff retry logic for all OpenRouter API calls via Airia with maximum 3 attempts
4. THE System SHALL implement exponential backoff retry logic for all Agentuity API calls with maximum 3 attempts
5. THE System SHALL implement exponential backoff retry logic for all Modal API calls with maximum 2 attempts
6. THE System SHALL implement exponential backoff retry logic for all Retell AI API calls with maximum 3 attempts
7. THE System SHALL detect rate limiting responses from GitHub API and pause requests until quota resets
8. THE System SHALL detect rate limiting responses from Airia and activate fallback routing policies
9. THE System SHALL detect rate limiting responses from Retell AI and queue voice requests with estimated wait time
10. IF all retry attempts fail, THEN THE System SHALL display a user-friendly error message with suggested actions
11. THE System SHALL log all API failures with redacted error details for debugging
12. THE System SHALL continue analysis with degraded functionality if non-critical services are unavailable
13. IF Airia is unavailable, THEN THE System SHALL pause new Airia-dependent agent operations while allowing read-only access to existing Sanitized Artifacts
14. IF Retell AI is unavailable, THEN THE System SHALL disable voice features and continue with text-based interaction

### Requirement 21

**User Story:** As a developer, I want clear error messages when analysis fails, so that I can understand what went wrong and how to fix it

#### Acceptance Criteria

1. THE System SHALL display user-friendly error messages without exposing technical implementation details
2. THE System SHALL provide actionable suggestions for resolving errors
3. THE System SHALL categorize errors as user errors, system errors, or external service errors
4. WHEN a GitHub authentication error occurs, THE System SHALL guide the Developer to re-authenticate
5. WHEN an Analysis Scope error occurs, THE System SHALL suggest reducing scope or excluding specific files
6. WHEN a model availability error occurs, THE System SHALL offer alternative models
7. THE System SHALL provide a "Report Issue" option that captures relevant context without sensitive data


### Requirement 22

**User Story:** As an administrator, I want Airia to centrally govern all LLM traffic with per-tenant policies, so that I can ensure compliance and control across the organization

#### Acceptance Criteria

1. THE System SHALL integrate Airia as the control plane for all analysis and code-execution agents
2. THE System SHALL define Agent Policies in Airia including allowed models, data access rules, cost limits, and sensitive-data masking rules
3. THE System SHALL enforce Agent Policies at the Tenant level with inheritance from organization defaults
4. THE System SHALL route all LLM requests exclusively through Airia's Multi-LLM Routing layer with no direct service access
5. THE System SHALL apply Airia's sensitive-data masking to all code sent to LLM services
6. WHEN an Agent Policy violation is detected, THEN THE System SHALL block the operation and log the redacted violation
7. THE System SHALL allow Administrators to configure per-tenant Agent Policies via Airia dashboard
8. THE System SHALL apply risk guardrails defined in Airia to prevent sensitive data exposure
9. THE System SHALL use Airia data connectors for secure access to GitHub, OpenRouter, and Modal APIs
10. THE System SHALL enforce model allowlists and constraints centrally via Airia policy engine rather than per-service configuration

### Requirement 23

**User Story:** As an administrator, I want to version and A/B test different analysis agents, so that I can continuously improve onboarding quality

#### Acceptance Criteria

1. THE System SHALL define Agent Flows in Airia with semantic versioning
2. THE System SHALL support multiple versions of Agent Flows running concurrently
3. THE System SHALL allow Administrators to configure A/B testing splits for Agent Flows
4. WHEN A/B testing is enabled, THE System SHALL randomly assign Onboarding Sessions to Agent Flow versions based on configured splits
5. THE System SHALL track performance metrics per Agent Flow version including completion rate, user satisfaction, and Session Cost
6. THE System SHALL allow Administrators to promote Agent Flow versions to production
7. THE System SHALL maintain audit trail of Agent Flow version deployments
8. THE System SHALL support rollback to previous Agent Flow versions within 5 minutes

### Requirement 24

**User Story:** As a developer, I want automatic fallbacks when third-party APIs fail, so that my onboarding session continues without interruption

#### Acceptance Criteria

1. THE System SHALL configure fallback models in Airia for each analysis task type
2. WHEN OpenRouter API fails after retry attempts, THEN THE System SHALL automatically route to fallback model via Airia
3. WHEN GitHub API is rate-limited, THEN THE System SHALL use cached repository data if available
4. WHEN Modal API fails, THEN THE System SHALL fallback to static diagram generation
5. THE System SHALL notify the Developer when fallback mechanisms are activated
6. THE System SHALL log all fallback activations with context for Administrator review
7. THE System SHALL continue analysis with degraded functionality rather than complete failure

### Requirement 25

**User Story:** As an administrator, I want to control which models and agents Airia can route to per tenant, so that I can manage costs and compliance requirements

#### Acceptance Criteria

1. THE System SHALL allow Administrators to define allowed model lists per Tenant in Airia
2. THE System SHALL allow Administrators to set cost limits per model per Tenant
3. THE System SHALL allow Administrators to disable specific Agent Flows per Tenant
4. THE System SHALL enforce model allowlists at request time via Airia routing
5. IF a requested model is not allowed for a Tenant, THEN THE System SHALL select the closest allowed alternative
6. THE System SHALL provide usage reports per Tenant showing model distribution and costs
7. THE System SHALL allow Administrators to configure model routing preferences including latency vs cost optimization

### Requirement 26

**User Story:** As a developer, I want to join a voice-based onboarding session, so that I can learn about the codebase through natural conversation

#### Acceptance Criteria

1. THE System SHALL integrate Retell AI for real-time voice interactions
2. THE System SHALL provide phone dial-in and web-based voice options for Voice Sessions
3. WHEN a Developer starts a Voice Session, THE System SHALL initialize a Retell AI agent with codebase context
4. THE System SHALL maintain voice latency below 800 milliseconds for natural conversation flow
5. THE System SHALL support Barge-in allowing the Developer to interrupt the voice agent
6. THE System SHALL synchronize voice explanations with terminal UI and visual outputs in real-time
7. THE System SHALL generate live transcripts of Voice Sessions linked to code locations
8. THE System SHALL allow the Developer to ask questions about architecture, data flow, and specific code sections via voice

### Requirement 27

**User Story:** As a developer, I want to invite team members to listen in on my voice onboarding session, so that we can learn together

#### Acceptance Criteria

1. THE System SHALL support collaborative "listen in" mode for Voice Sessions
2. THE System SHALL allow the Developer to generate a join link for Collaborators
3. WHEN a Collaborator joins a Voice Session, THE System SHALL synchronize their view with the current session state
4. THE System SHALL display presence indicators showing all participants in the Voice Session
5. THE System SHALL allow multiple Collaborators to ask questions via voice with turn-taking
6. THE System SHALL enforce Tenant isolation for Voice Session access
7. THE System SHALL log all Collaborator joins and departures for audit

### Requirement 28

**User Story:** As a developer, I want voice interactions to respect my privacy with separate audio and transcript retention policies, so that I can use voice features safely

#### Acceptance Criteria

1. THE System SHALL distinguish between audio recordings and voice transcripts with separate retention policies
2. THE System SHALL delete voice audio recordings within 24 hours of session completion by default
3. THE System SHALL allow Tenant-level Audio Retention Policy configuration from immediate deletion to 90 days
4. THE System SHALL allow Tenant-level Transcript Retention Policy configuration from 24 hours to 2 years
5. THE System SHALL sanitize all voice transcripts to remove raw code, secrets, and PII before any persistence beyond session duration
6. THE System SHALL store only Sanitized Artifact versions of transcripts when retention exceeds 24 hours
7. THE System SHALL encrypt voice data in transit using SRTP protocol
8. THE System SHALL not transmit voice audio to services other than Retell AI
9. THE System SHALL transmit only summarized context to Retell AI without raw repository code
10. THE System SHALL allow the Developer to opt-out of voice recording while maintaining transcript generation

### Requirement 29

**User Story:** As an administrator, I want to control which Retell entrypoints are enabled per tenant, so that I can manage voice feature access

#### Acceptance Criteria

1. THE System SHALL allow Administrators to enable or disable phone dial-in per Tenant
2. THE System SHALL allow Administrators to enable or disable web voice per Tenant
3. THE System SHALL allow Administrators to set maximum concurrent Voice Sessions per Tenant
4. THE System SHALL allow Administrators to configure voice agent personality and behavior per Tenant
5. THE System SHALL enforce voice feature access controls at session creation time
6. IF voice features are disabled for a Tenant, THEN THE System SHALL hide voice UI elements
7. THE System SHALL provide usage reports showing Voice Session counts and duration per Tenant

### Requirement 30

**User Story:** As a developer, I want to replay my onboarding session as a sanitized interactive script, so that I can review and share what I learned without exposing code

#### Acceptance Criteria

1. THE System SHALL generate an Interactive Script as a Sanitized Artifact for every completed Onboarding Session
2. THE System SHALL sanitize all content including explanations, diagrams, and voice transcripts to remove raw code, secrets, and PII before persisting in Interactive Scripts
3. THE System SHALL replace code snippets with references to file paths and line numbers in Interactive Scripts
4. THE System SHALL allow the Developer to replay the Interactive Script with synchronized playback of sanitized voice transcripts and visuals
5. THE System SHALL provide timeline navigation controls for jumping to specific sections
6. THE System SHALL link voice transcript segments to file and line number references rather than raw code
7. THE System SHALL allow the Developer to export the Interactive Script as a downloadable bundle
8. THE System SHALL support playback speed control from 0.5x to 2x
9. THE System SHALL allow the Developer to add annotations and notes to the Interactive Script
10. THE System SHALL honor Transcript Retention Policy when generating Interactive Scripts with voice content
11. THE System SHALL never persist raw code, secrets, or PII in any Interactive Script regardless of retention policy

### Requirement 31

**User Story:** As a team lead, I want to standardize onboarding flows with sanitized templates across codebases, so that new team members have consistent learning experiences

#### Acceptance Criteria

1. THE System SHALL allow team leads to save Interactive Scripts as Sanitized Artifact templates
2. THE System SHALL sanitize all template content to remove raw code, secrets, and PII before any persistence or sharing
3. THE System SHALL enforce that only Sanitized Artifacts can be stored in templates
4. THE System SHALL allow team leads to share Interactive Script templates across Tenants with permission
5. THE System SHALL allow customization of Interactive Script templates for specific repositories
6. THE System SHALL track usage of Interactive Script templates with analytics
7. THE System SHALL allow team leads to version Interactive Script templates
8. THE System SHALL provide a library view of available Interactive Script templates
9. THE System SHALL allow Developers to provide feedback on Interactive Script templates for iterative improvement
10. THE System SHALL validate that all templates contain only Sanitized Artifacts before allowing cross-tenant sharing
11. THE System SHALL reject template creation or sharing if raw code, secrets, or PII are detected

### Requirement 32

**User Story:** As a developer, I want voice interactions to guide me through architecture maps and diff history, so that I can understand complex relationships through conversation

#### Acceptance Criteria

1. THE System SHALL enable the voice agent to reference and explain architecture diagrams during Voice Sessions
2. THE System SHALL allow the Developer to ask the voice agent to show specific architecture components
3. THE System SHALL enable the voice agent to walk through Git commit history and explain changes
4. THE System SHALL synchronize diagram highlighting with voice explanations
5. THE System SHALL allow the Developer to request comparison of different code versions via voice
6. THE System SHALL enable the voice agent to trace data flow paths while explaining them verbally
7. THE System SHALL provide visual indicators on diagrams corresponding to voice agent's current explanation focus

### Requirement 33

**User Story:** As an administrator, I want comprehensive governance over Airia-managed agent lifecycles, so that I can maintain control and visibility

#### Acceptance Criteria

1. THE System SHALL provide an administrative dashboard showing all active Agent Flows and their versions
2. THE System SHALL display real-time metrics for each Agent Flow including invocation count, success rate, and average cost
3. THE System SHALL allow Administrators to pause or disable Agent Flows without redeployment
4. THE System SHALL enforce policy-enforced prompts defined in Airia for all agent interactions
5. THE System SHALL log all agent invocations with input parameters and outputs for audit
6. THE System SHALL alert Administrators when Agent Flow error rates exceed 10 percent
7. THE System SHALL provide cost projections based on current Agent Flow usage patterns
8. THE System SHALL allow Administrators to configure automatic scaling limits for Agent Flows


### Requirement 34

**User Story:** As a developer, I want deterministic re-runs of analysis within a fixed configuration, so that I can reproduce results reliably

#### Acceptance Criteria

1. THE System SHALL produce deterministic outputs when using the same Agent Flow version, model set, and random seed
2. THE System SHALL allow the Developer to specify a random seed for reproducible analysis
3. THE System SHALL record the Agent Flow version, model identifiers, and seed used for each Onboarding Session
4. WHEN Agent Policies, Agent Flows, or model availability changes, THE System SHALL not guarantee deterministic re-runs
5. THE System SHALL display a warning when re-running analysis with different Agent Flow version or model set
6. THE System SHALL allow the Developer to lock an Onboarding Session to specific Agent Flow version and models
7. THE System SHALL provide a "reproduce exact session" option that uses recorded configuration parameters
8. IF Airia routing policies have changed, THEN THE System SHALL notify the Developer that results may differ

### Requirement 35

**User Story:** As an administrator, I want to export and version all Airia and Retell configurations, so that onboarding behavior is reviewable and reproducible

#### Acceptance Criteria

1. THE System SHALL allow Administrators to export Airia Agent Policies as versioned configuration files
2. THE System SHALL allow Administrators to export Airia routing rules as versioned configuration files
3. THE System SHALL allow Administrators to export Retell AI voice personas as versioned configuration files
4. THE System SHALL allow Administrators to export all Agent Flow definitions with their dependencies
5. THE System SHALL version all configuration exports with semantic versioning
6. THE System SHALL store configuration versions alongside Agent Flow versions in version control
7. THE System SHALL allow Administrators to import and apply configuration versions
8. THE System SHALL validate configuration compatibility before applying imported versions
9. THE System SHALL maintain audit trail of configuration version changes
10. THE System SHALL allow Administrators to diff configuration versions to review changes
11. THE System SHALL export configurations in human-readable YAML or JSON format

### Requirement 36

**User Story:** As an administrator, I want centralized observability for Airia and Retell operations, so that I can monitor governance and voice feature health

#### Acceptance Criteria

1. THE System SHALL emit metrics for Airia policy enforcement events including violations and fallbacks
2. THE System SHALL emit metrics for Airia routing decisions including model selection and latency
3. THE System SHALL emit metrics for Retell AI voice sessions including duration, participant count, and quality scores
4. THE System SHALL track Retell AI voice latency with alerts when exceeding 800 milliseconds
5. THE System SHALL provide dashboards showing Airia governance metrics per Tenant
6. THE System SHALL provide dashboards showing Retell AI usage and quality metrics per Tenant
7. THE System SHALL alert Administrators when Airia policy violations exceed 5 percent of requests
8. THE System SHALL alert Administrators when Retell AI session quality scores drop below 4 out of 5
9. THE System SHALL log all Airia and Retell API errors with redacted context for debugging


### Requirement 37

**User Story:** As an administrator, I want role-based access control with least-privilege principles, so that users have appropriate access to features and data

#### Acceptance Criteria

1. THE System SHALL implement RBAC with four roles: Developer, Collaborator, Team Lead, and Administrator
2. THE System SHALL grant Developers full access to their own Onboarding Sessions and Learning Profiles
3. THE System SHALL grant Collaborators read-only or interactive access to shared sessions based on invitation permissions
4. THE System SHALL grant Team Leads access to create templates, view team analytics, and manage team member session access
5. THE System SHALL grant Administrators access to all system configuration, policies, audit logs, and cross-tenant analytics
6. THE System SHALL prevent Collaborators from accessing session data beyond their granted permissions
7. THE System SHALL prevent Team Leads from accessing Administrator functions including policy configuration
8. THE System SHALL prevent Developers from accessing other Developers' sessions without explicit sharing
9. THE System SHALL enforce least-privilege access at the API level for all operations
10. THE System SHALL log all permission checks and access denials for audit
11. THE System SHALL allow Administrators to assign and revoke roles per Tenant

### Requirement 38

**User Story:** As an administrator, I want strong authentication with SSO and optional MFA, so that user accounts are secure

#### Acceptance Criteria

1. THE System SHALL support SSO authentication via OIDC protocol
2. THE System SHALL support optional MFA for all user roles
3. THE System SHALL require MFA for Administrator role by default
4. THE System SHALL allow Administrators to enforce MFA per Tenant
5. THE System SHALL support TOTP and WebAuthn as MFA methods
6. THE System SHALL implement session management with secure session tokens
7. THE System SHALL expire inactive sessions after 8 hours
8. THE System SHALL allow users to view and revoke active sessions
9. THE System SHALL log all authentication events including SSO and MFA attempts
10. IF SSO provider is unavailable, THEN THE System SHALL display maintenance message and prevent login
11. THE System SHALL support multiple SSO providers per Tenant for enterprise flexibility

### Requirement 39

**User Story:** As a developer, I want all cached and intermediate data to have the same security guarantees as my repository code, so that no data leaks through side channels

#### Acceptance Criteria

1. THE System SHALL apply sanitization to all Intermediate Artifacts including embeddings and diagram inputs
2. THE System SHALL delete all raw repository data and Intermediate Artifacts within 24 hours of Onboarding Session completion
3. THE System SHALL retain Sanitized Artifacts and Interactive Scripts according to their own retention policies independent of the 24-hour rule
4. THE System SHALL encrypt all Intermediate Artifacts at rest using AES-256 encryption
5. THE System SHALL apply Tenant isolation to all caches and indexes
6. THE System SHALL not include raw repository code in embeddings or cached analysis results
7. THE System SHALL honor Transcript Retention Policy for all transcript content used in Interactive Scripts
8. THE System SHALL treat all transcript content in Interactive Scripts and templates as Sanitized Artifacts
9. THE System SHALL delete cached repository metadata when the Developer deletes session data
10. THE System SHALL not persist diagram inputs beyond the rendering operation
11. THE System SHALL apply the 24-hour deletion guarantee to all temporary files and working directories containing raw code or Intermediate Artifacts

### Requirement 40

**User Story:** As a developer, I want access to previously generated artifacts when Airia is unavailable, so that I can review past work without disruption

#### Acceptance Criteria

1. WHEN Airia is unavailable, THE System SHALL allow read-only access to previously generated Sanitized Artifacts
2. WHEN Airia is unavailable, THE System SHALL allow playback of existing Interactive Scripts
3. WHEN Airia is unavailable, THE System SHALL allow export of existing session data
4. WHEN Airia is unavailable, THE System SHALL pause all new LLM-powered analysis operations
5. WHEN Airia is unavailable, THE System SHALL display a status message indicating limited functionality
6. WHEN Airia is unavailable, THE System SHALL prevent creation of new Onboarding Sessions
7. WHEN Airia is unavailable, THE System SHALL prevent modification of existing sessions
8. THE System SHALL resume full functionality automatically when Airia becomes available
9. THE System SHALL log Airia availability status changes for monitoring

### Requirement 41

**User Story:** As a developer, I want Retell voice interactions to respect the same governance as text interactions, so that voice doesn't bypass security controls

#### Acceptance Criteria

1. THE System SHALL route all Retell AI context through Airia's policy engine before transmission
2. THE System SHALL apply Airia's sensitive-data masking to all context sent to Retell AI
3. THE System SHALL enforce the same model and tenant policies for voice-generated responses as text responses
4. THE System SHALL configure Retell AI voice personas using Airia-governed parameters
5. THE System SHALL enforce Airia policies for barge-in and turn-taking behavior
6. THE System SHALL not allow Retell AI to bypass Airia routing for any LLM requests
7. THE System SHALL apply unified cost governance as defined in Requirement 16 to voice interactions
8. THE System SHALL log all Retell AI context transmissions with redacted content for audit
9. IF Airia policies prohibit certain data access, THEN THE System SHALL prevent Retell AI from accessing that data
10. THE System SHALL synchronize Retell AI voice agent state with Airia-governed session state

### Requirement 42

**User Story:** As an administrator, I want comprehensive session management controls, so that I can enforce security policies and manage active sessions

#### Acceptance Criteria

1. THE System SHALL allow Administrators to view all active sessions per Tenant
2. THE System SHALL allow Administrators to terminate active sessions for security or policy reasons
3. THE System SHALL allow Administrators to configure maximum session duration per Tenant
4. THE System SHALL automatically terminate sessions exceeding maximum duration
5. THE System SHALL notify users before automatic session termination with 5 minute warning
6. THE System SHALL allow Administrators to configure maximum concurrent sessions per user
7. THE System SHALL enforce concurrent session limits at session creation time
8. THE System SHALL log all session terminations including reason and initiator
9. THE System SHALL allow users to gracefully save work before forced termination
10. THE System SHALL provide session analytics including average duration and resource usage per Tenant
