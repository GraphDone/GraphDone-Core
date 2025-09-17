# 🚀 GraphDone Installation Flow

## One-Liner Installation Process

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'lineColor': '#68D391',
    'secondaryColor': '#4A5568',
    'tertiaryColor': '#718096',
    'background': '#1A202C',
    'mainBkg': '#2D3748',
    'secondBkg': '#374151',
    'tertiaryBkg': '#4A5568',
    'clusterBkg': '#374151'
  }
}}%%

flowchart TD
    Start([User runs curl/wget]) --> Fetch[Fetch start.sh from GitHub]
    Fetch --> CheckReq{Check Requirements}
    
    CheckReq -->|Missing| ReqError[Show missing tools<br/>Docker, Git]
    CheckReq -->|OK| CheckDir{Check ~/graphdone}
    
    ReqError --> Exit([Exit with instructions])
    
    CheckDir -->|Exists| Update[Pull latest changes]
    CheckDir -->|New| Clone[Clone repository]
    
    Update --> CheckEnv
    Clone --> CheckEnv{Check .env file}
    
    CheckEnv -->|Exists| CheckCerts
    CheckEnv -->|Missing| CreateEnv[Create .env with<br/>HTTPS config]
    
    CreateEnv --> CheckCerts{Check TLS certificates}
    
    CheckCerts -->|Exist| RunSmartStart
    CheckCerts -->|Missing| GenCerts[Generate certificates<br/>with OpenSSL]
    
    GenCerts --> RunSmartStart[Run smart-start]
    
    RunSmartStart --> SmartDetect{Smart Detection}
    
    SmartDetect -->|Registry OK| PullImages[Pull Docker images<br/>from registry]
    SmartDetect -->|No Registry| LocalBuild[Build locally<br/>with npm]
    
    PullImages --> StartServices
    LocalBuild --> StartServices[Start Services]
    
    StartServices --> CheckHealth{Health Check}
    
    CheckHealth -->|Pass| Success[GraphDone Ready<br/>https://localhost:3128]
    CheckHealth -->|Fail| ShowLogs[Show troubleshooting<br/>instructions]
    
    classDef startNode fill:#3B82F6,stroke:#1D4ED8,stroke-width:2px,color:#FFFFFF
    classDef processNode fill:#10B981,stroke:#059669,stroke-width:2px,color:#FFFFFF
    classDef decisionNode fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#FFFFFF
    classDef errorNode fill:#EF4444,stroke:#DC2626,stroke-width:2px,color:#FFFFFF
    classDef successNode fill:#22C55E,stroke:#16A34A,stroke-width:3px,color:#FFFFFF
    
    class Start startNode
    class Fetch,Update,Clone,CreateEnv,GenCerts,RunSmartStart,PullImages,LocalBuild,StartServices processNode
    class CheckReq,CheckDir,CheckEnv,CheckCerts,SmartDetect,CheckHealth decisionNode
    class ReqError,Exit,ShowLogs errorNode
    class Success successNode
```

## Smart-Start Decision Flow

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'lineColor': '#68D391',
    'secondaryColor': '#4A5568',
    'tertiaryColor': '#718096',
    'background': '#1A202C',
    'mainBkg': '#2D3748',
    'secondBkg': '#374151',
    'tertiaryBkg': '#4A5568',
    'clusterBkg': '#374151'
  }
}}%%

flowchart TD
    Start([smart-start]) --> CheckDeps{Check Dependencies}
    
    CheckDeps -->|Missing Node| InstallNode[Install Node.js<br/>via nvm]
    CheckDeps -->|Missing Docker| InstallDocker[Install/Fix Docker]
    CheckDeps -->|All OK| CheckMode{Detect Mode}
    
    InstallNode --> CheckMode
    InstallDocker --> CheckMode
    
    CheckMode --> TryRegistry{Try Registry Images}
    
    TryRegistry -->|Success| RegistryMode[Use Pre-built Images<br/>ghcr.io/graphdone/*]
    TryRegistry -->|Fail| CheckLocal{Check Local Build}
    
    CheckLocal -->|npm exists| LocalMode[Build from Source<br/>npm run build]
    CheckLocal -->|No npm| DockerMode[Use Docker Compose<br/>docker-compose up]
    
    RegistryMode --> ConfigureSSL
    LocalMode --> ConfigureSSL
    DockerMode --> ConfigureSSL{Configure SSL/TLS}
    
    ConfigureSSL -->|Dev| HTTPMode[HTTP Mode<br/>Ports 3127/4127]
    ConfigureSSL -->|Prod| HTTPSMode[HTTPS Mode<br/>Ports 3128/4128]
    
    HTTPMode --> StartContainers
    HTTPSMode --> StartContainers[Start Containers]
    
    StartContainers --> WaitHealth[Wait for Health Checks]
    
    WaitHealth -->|Ready| CheckAPI{API Health}
    WaitHealth -->|Timeout| Retry[Retry with logs]
    
    CheckAPI -->|Ready| CheckWeb{Web Health}
    CheckAPI -->|Not Ready| ShowAPILogs[Show API logs]
    
    CheckWeb -->|Ready| Complete[All Systems Go]
    CheckWeb -->|Not Ready| ShowWebLogs[Show Web logs]
    
    Complete --> DisplayURLs[Display Access URLs<br/>and Commands]
    
    classDef startNode fill:#3B82F6,stroke:#1D4ED8,stroke-width:2px,color:#FFFFFF
    classDef processNode fill:#10B981,stroke:#059669,stroke-width:2px,color:#FFFFFF
    classDef decisionNode fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#FFFFFF
    classDef modeNode fill:#8B5CF6,stroke:#7C3AED,stroke-width:2px,color:#FFFFFF
    classDef successNode fill:#22C55E,stroke:#16A34A,stroke-width:3px,color:#FFFFFF
    classDef errorNode fill:#EF4444,stroke:#DC2626,stroke-width:2px,color:#FFFFFF
    
    class Start startNode
    class InstallNode,InstallDocker,WaitHealth,Retry,ShowAPILogs,ShowWebLogs,DisplayURLs processNode
    class CheckDeps,CheckMode,TryRegistry,CheckLocal,ConfigureSSL,CheckAPI,CheckWeb decisionNode
    class RegistryMode,LocalMode,DockerMode,HTTPMode,HTTPSMode modeNode
    class Complete successNode
```

## Service Architecture

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'lineColor': '#68D391',
    'secondaryColor': '#4A5568',
    'tertiaryColor': '#718096',
    'background': '#1A202C',
    'mainBkg': '#2D3748',
    'secondBkg': '#374151',
    'tertiaryBkg': '#4A5568',
    'clusterBkg': '#374151'
  }
}}%%

graph TB
    subgraph User ["User's Machine"]
        CLI[curl/wget command]
        Browser[Web Browser]
    end
    
    subgraph GitHub ["GitHub Ecosystem"]
        Repo[GraphDone-Core Repository]
        Script[public/start.sh]
        Registry[ghcr.io Registry]
    end
    
    subgraph Local ["Local Installation ~/graphdone"]
        SmartStart[smart-start]
        ENV[.env configuration]
        Certs[TLS Certificates]
        
        subgraph Containers ["Docker Containers"]
            Neo4j[Neo4j Database<br/>:7474/:7687]
            Redis[Redis Cache<br/>:6379]
            API[GraphQL API<br/>:4128]
            Web[Web UI<br/>:3128]
        end
    end
    
    CLI -->|1. Fetch| Script
    Script -->|2. Clone| Repo
    Repo -->|3. Install| SmartStart
    SmartStart -->|4. Pull Images| Registry
    SmartStart -->|5. Configure| ENV
    SmartStart -->|6. Generate| Certs
    SmartStart -->|7. Start| Neo4j
    SmartStart -->|8. Start| Redis
    SmartStart -->|9. Start| API
    SmartStart -->|10. Start| Web
    
    Browser -->|HTTPS| Web
    Web -->|GraphQL| API
    API -->|Cypher| Neo4j
    API -->|Cache| Redis
    
    classDef userNode fill:#3B82F6,stroke:#1D4ED8,stroke-width:2px,color:#FFFFFF
    classDef githubNode fill:#8B5CF6,stroke:#7C3AED,stroke-width:2px,color:#FFFFFF
    classDef configNode fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#FFFFFF
    classDef containerNode fill:#10B981,stroke:#059669,stroke-width:2px,color:#FFFFFF
    classDef scriptNode fill:#EF4444,stroke:#DC2626,stroke-width:2px,color:#FFFFFF
    classDef smartNode fill:#22C55E,stroke:#16A34A,stroke-width:3px,color:#FFFFFF
    
    class CLI,Browser userNode
    class Repo,Registry githubNode
    class ENV,Certs configNode
    class Neo4j,Redis,API,Web containerNode
    class Script scriptNode
    class SmartStart smartNode
```

## Error Recovery Flow

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'lineColor': '#68D391',
    'secondaryColor': '#4A5568',
    'tertiaryColor': '#718096',
    'background': '#1A202C',
    'mainBkg': '#2D3748',
    'secondBkg': '#374151',
    'tertiaryBkg': '#4A5568',
    'clusterBkg': '#374151'
  }
}}%%

flowchart LR
    subgraph Issues ["Common Issues"]
        E1[Docker not running]
        E2[Port conflict]
        E3[SSL cert error]
        E4[Network timeout]
    end
    
    subgraph AutoFix ["Auto-Recovery"]
        F1[Start Docker daemon]
        F2[Kill conflicting process]
        F3[Regenerate certificates]
        F4[Retry with timeout]
    end
    
    subgraph Manual ["Manual Recovery"]
        M1[./start stop<br/>./smart-start]
        M2[./start remove<br/>./smart-start]
        M3[Check logs<br/>docker logs]
    end
    
    E1 --> F1
    E2 --> F2
    E3 --> F3
    E4 --> F4
    
    F1 -->|Fail| M1
    F2 -->|Fail| M1
    F3 -->|Fail| M2
    F4 -->|Fail| M3
    
    classDef errorNode fill:#EF4444,stroke:#DC2626,stroke-width:2px,color:#FFFFFF
    classDef autoNode fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#FFFFFF
    classDef manualNode fill:#3B82F6,stroke:#1D4ED8,stroke-width:2px,color:#FFFFFF
    
    class E1,E2,E3,E4 errorNode
    class F1,F2,F3,F4 autoNode
    class M1,M2,M3 manualNode
```

## Installation Methods Comparison

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'lineColor': '#68D391',
    'secondaryColor': '#4A5568',
    'tertiaryColor': '#718096',
    'background': '#1A202C',
    'mainBkg': '#2D3748',
    'secondBkg': '#374151',
    'tertiaryBkg': '#4A5568',
    'clusterBkg': '#374151'
  }
}}%%

graph TD
    subgraph Methods ["Installation Methods"]
        OneLineCurl[curl one-liner<br/>Fastest & Universal]
        OneLineWget[wget one-liner<br/>Linux preferred]
        GitClone[git clone + smart-start<br/>Developer mode]
        Docker[docker compose<br/>Container only]
    end
    
    subgraph Features ["Available Features"]
        AutoSetup[Auto setup]
        TLSCerts[TLS certificates]
        SmartDetect[Smart detection]
        Registry[Pre-built images]
        LocalBuild[Local build]
    end
    
    OneLineCurl --> AutoSetup
    OneLineCurl --> TLSCerts
    OneLineCurl --> SmartDetect
    OneLineCurl --> Registry
    
    OneLineWget --> AutoSetup
    OneLineWget --> TLSCerts
    OneLineWget --> SmartDetect
    OneLineWget --> Registry
    
    GitClone --> SmartDetect
    GitClone --> LocalBuild
    GitClone --> TLSCerts
    
    Docker --> Registry
    
    classDef recommendedNode fill:#22C55E,stroke:#16A34A,stroke-width:3px,color:#FFFFFF
    classDef alternativeNode fill:#10B981,stroke:#059669,stroke-width:2px,color:#FFFFFF
    classDef devNode fill:#3B82F6,stroke:#1D4ED8,stroke-width:2px,color:#FFFFFF
    classDef containerNode fill:#8B5CF6,stroke:#7C3AED,stroke-width:2px,color:#FFFFFF
    classDef featureNode fill:#F59E0B,stroke:#D97706,stroke-width:2px,color:#FFFFFF
    
    class OneLineCurl recommendedNode
    class OneLineWget alternativeNode
    class GitClone devNode
    class Docker containerNode
    class AutoSetup,TLSCerts,SmartDetect,Registry,LocalBuild featureNode
```

## Installation Timeline

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'gridColor': '#4A5568',
    'background': '#1A202C',
    'altBackground': '#374151',
    'todayMarker': '#68D391',
    'c0': '#10B981',
    'c1': '#3B82F6',
    'c2': '#8B5CF6',
    'c3': '#F59E0B',
    'c4': '#EF4444',
    'c5': '#22C55E',
    'cScale0': '#10B981',
    'cScale1': '#3B82F6',
    'cScale2': '#8B5CF6',
    'cScale3': '#F59E0B',
    'cScale4': '#EF4444',
    'cScale5': '#22C55E'
  }
}}%%

gantt
    title 🚀 GraphDone Installation Timeline (~60 seconds)
    dateFormat ss
    axisFormat %Ss
    
    section 📥 Download
    📝 Fetch install script    :done, fetch, 00, 1s
    📋 Clone from GitHub       :done, clone, 01, 5s
    
    section ⚙️ Setup
    🔍 Check dependencies      :done, req, 06, 1s
    📄 Configure environment   :done, env, 07, 1s
    🔒 Generate TLS certs      :done, cert, 08, 2s
    
    section 🐳 Docker Images
    🗄️ Pull Neo4j (70MB)      :active, neo4j, 10, 10s
    ⚡ Pull Redis (15MB)       :active, redis, 10, 3s
    🔌 Pull API (120MB)        :active, api, 10, 8s
    🌐 Pull Web (80MB)         :active, web, 10, 8s
    
    section 🚀 Services
    🗄️ Start Neo4j DB         :crit, startneo, 20, 15s
    ⚡ Start Redis Cache       :startredis, 13, 2s
    🔌 Start GraphQL API       :startapi, 35, 5s
    🌐 Start Web Interface     :startweb, 40, 3s
    
    section ✅ Complete
    💚 Health check pass       :milestone, health, 43, 5s
    🎯 GraphDone ready!        :milestone, ready, 48, 0s
```

---

## Professional Design Features

### 🎯 **Optimized for Readability**
- **Clean white backgrounds** with subtle gray borders
- **High contrast dark text** (#1F2937) for maximum legibility
- **Minimal visual noise** - no unnecessary gradients or effects
- **Clear typography** that works at any zoom level

### 🎨 **Consistent Color System**
- **Blue (#3B82F6)**: Start points and user actions
- **Green (#10B981/#22C55E)**: Processes and success states  
- **Orange (#F59E0B)**: Decisions and configuration
- **Red (#EF4444)**: Errors and critical paths
- **Purple (#8B5CF6)**: Special modes and advanced features

### 📱 **Professional Standards**
- **Enterprise-ready**: Suitable for documentation and presentations
- **Accessibility compliant**: High contrast ratios (WCAG AA)
- **Print-friendly**: Works in both screen and print media
- **GitHub optimized**: Renders perfectly in GitHub's interface

### 🔍 **Enhanced Usability**
- **Reduced emoji usage** for professional environments
- **Clear node shapes** that indicate purpose (rectangles=actions, diamonds=decisions)
- **Logical flow direction** (top-down for processes, left-right for recovery)
- **Grouped elements** with subtle background differentiation