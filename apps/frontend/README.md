# Codebase Onboarding Agent - Frontend

React-based frontend application for the Codebase Onboarding Agent with a minimalistic, developer-focused UI.

## Components Overview

### Authentication (`/components/auth`)
- **LoginPage**: SSO/OIDC authentication with provider selection
- **MFAEnrollment**: TOTP and WebAuthn enrollment flows
- **MFAVerification**: Two-factor authentication verification
- **SessionManagement**: Active session viewing and revocation
- **RoleBasedNav**: Navigation based on user roles (Developer, Collaborator, TeamLead, Administrator)

### Repository Selection (`/components/repository`)
- **RepositoryList**: Paginated GitHub repository browser with search
- **RepositoryUrlInput**: Direct repository URL input with validation
- **FileTreeViewer**: Interactive file tree with selection
- **AnalysisScopeConfig**: Scope configuration with size validation and cost estimation

### Terminal (`/components/terminal`)
- **Terminal**: Interactive terminal with command history and autocomplete
- **TerminalHistory**: Message display with syntax highlighting
- **TerminalInput**: Command input with suggestions
- **CommandPalette**: Searchable command palette (Ctrl+K)
- WCAG 2.1 Level AA accessible

### Session Viewer (`/components/session`)
- **SessionViewer**: Real-time analysis results display
- **AnalysisResults**: Summary and detailed analysis view
- **ArchitectureDiagram**: Architecture pattern visualization
- **DataFlowVisualization**: Data flow path rendering
- **CodeReferenceNav**: Feature location browser with code references

### Voice Interface (`/components/voice`)
- **VoiceInterface**: WebRTC voice session management
- **VoiceControls**: Start, pause, resume, end controls
- **TranscriptDisplay**: Live transcript with code references
- **VoiceVisualSync**: Voice-visual synchronization display

### Monitoring (`/components/monitoring`)
- **CostMonitor**: Real-time cost tracking with warnings
- **SessionProgress**: Progress indicators with ETA
- **TerminationCountdown**: Session termination countdown with cancellation

### Script Player (`/components/script`)
- **ScriptPlayer**: Interactive script playback
- **PlaybackControls**: Play, pause, speed controls (0.5x-2x)
- **ScriptTimeline**: Section navigation and timeline
- **ScriptContent**: Sanitized content display with diagrams
- **ScriptAnnotations**: Note-taking and annotation management

### Admin Dashboard (`/components/admin`)
- **AdminDashboard**: Main admin interface
- **TenantManagement**: Tenant CRUD operations
- **PolicyConfiguration**: Policy and cost limit configuration
- **UsageAnalytics**: Usage and cost analytics
- **AuditLogViewer**: Audit log filtering and export

## Design System

### Color Palette
- Background: `#1a1a1a` (primary), `#2a2a2a` (secondary)
- Text: `#e0e0e0` (primary), `#b0b0b0` (secondary), `#808080` (tertiary)
- Accent: `#6a9fb5` (primary blue)
- Success: `#5cb85c`
- Warning: `#ffc107`
- Error: `#d9534f`

### Typography
- Primary: System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto')
- Monospace: 'Courier New', 'Consolas', monospace

### Accessibility
- WCAG 2.1 Level AA compliant
- Keyboard navigation support
- Screen reader compatible with ARIA labels
- Focus indicators on all interactive elements
- High contrast mode support

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Component Usage Examples

### Authentication Flow
```tsx
import { LoginPage, MFAVerification } from './components/auth';

<LoginPage onLogin={handleLogin} />
<MFAVerification method="TOTP" onVerify={handleVerify} onCancel={handleCancel} />
```

### Terminal
```tsx
import { Terminal } from './components/terminal';

<Terminal
  onCommand={handleCommand}
  commands={availableCommands}
  welcomeMessage="Welcome to the agent"
/>
```

### Voice Interface
```tsx
import { VoiceInterface } from './components/voice';

<VoiceInterface
  sessionId={sessionId}
  voiceSession={voiceSession}
  onStartVoice={handleStart}
  onEndVoice={handleEnd}
  onPauseVoice={handlePause}
  onResumeVoice={handleResume}
/>
```

## Requirements Implemented

- **Req 38.1, 38.2, 38.8**: SSO login, MFA enrollment, session management
- **Req 2.1, 2.2, 3.1, 3.2, 3.3**: Repository selection and scope configuration
- **Req 12.1-12.9**: Terminal UI with accessibility
- **Req 6.4, 8.4, 32.2, 32.6**: Session viewer with diagrams and navigation
- **Req 26.2, 26.6, 26.7**: Voice interface with WebRTC
- **Req 16.6, 16.7**: Cost monitoring and warnings
- **Req 30.4, 30.5, 30.7, 30.8, 30.9**: Script player with playback controls
- **Req 15.7, 25.1, 25.2, 33.1, 33.2**: Admin dashboard

## Notes

- All components use TypeScript for type safety
- Shared types imported from `@codebase-onboarding/shared`
- CSS modules for component-scoped styling
- Responsive design for mobile and desktop
- Dark theme optimized for developer workflows
