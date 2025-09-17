# 🚀 GraphDone Installation Flow

## One-Liner Installation Process

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#1a1a2e',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#16213e',
    'lineColor': '#0f4c75',
    'secondaryColor': '#16213e',
    'tertiaryColor': '#0f4c75',
    'background': '#0d1421',
    'mainBkg': '#1a1a2e',
    'secondBkg': '#16213e',
    'tertiaryBkg': '#0f4c75'
  }
}}%%

flowchart TD
    Start([🌟 User runs curl/wget command]) --> FetchScript[📥 Fetch start.sh from GitHub]
    FetchScript --> CheckReq{🔍 Check Requirements}
    
    CheckReq -->|Missing| ReqError[❌ Show missing tools<br/>🐳 Docker, 📂 Git]
    CheckReq -->|OK| CheckDir{📁 Check ~/graphdone}
    
    ReqError --> Exit([🚪 Exit with instructions])
    
    CheckDir -->|Exists| Update[🔄 Pull latest changes<br/>git pull]
    CheckDir -->|New| Clone[📋 Clone repository<br/>from GitHub]
    
    Update --> CheckEnv
    Clone --> CheckEnv{⚙️ Check .env file}
    
    CheckEnv -->|Exists| CheckCerts
    CheckEnv -->|Missing| CreateEnv[🔧 Create .env with<br/>HTTPS configuration]
    
    CreateEnv --> CheckCerts{🔒 Check TLS certificates}
    
    CheckCerts -->|Exist| RunSmartStart
    CheckCerts -->|Missing| GenCerts[🛡️ Generate certificates<br/>with OpenSSL]
    
    GenCerts --> RunSmartStart[🧠 Run smart-start]
    
    RunSmartStart --> SmartDetect{🎯 Smart Detection}
    
    SmartDetect -->|Registry OK| PullImages[📦 Pull Docker images<br/>from ghcr.io]
    SmartDetect -->|No Registry| LocalBuild[🔨 Build locally<br/>with npm]
    
    PullImages --> StartServices
    LocalBuild --> StartServices[🚀 Start Services]
    
    StartServices --> CheckHealth{💚 Health Check}
    
    CheckHealth -->|Pass| Success[✨ GraphDone Ready!<br/>🌐 https://localhost:3128]
    CheckHealth -->|Fail| ShowLogs[🔍 Show troubleshooting<br/>instructions]
    
    classDef startStyle fill:#667eea,stroke:#764ba2,stroke-width:3px,color:#ffffff
    classDef processStyle fill:#f093fb,stroke:#f5576c,stroke-width:2px,color:#ffffff
    classDef decisionStyle fill:#4facfe,stroke:#00f2fe,stroke-width:2px,color:#ffffff
    classDef successStyle fill:#a8edea,stroke:#fed6e3,stroke-width:3px,color:#1a1a2e
    classDef errorStyle fill:#ff9a9e,stroke:#fecfef,stroke-width:2px,color:#ffffff
    classDef configStyle fill:#ffecd2,stroke:#fcb69f,stroke-width:2px,color:#1a1a2e
    
    class Start startStyle
    class FetchScript,Update,Clone,CreateEnv,GenCerts,RunSmartStart,PullImages,LocalBuild,StartServices processStyle
    class CheckReq,CheckDir,CheckEnv,CheckCerts,SmartDetect,CheckHealth decisionStyle
    class Success successStyle
    class ReqError,Exit,ShowLogs errorStyle
```

## 🧠 Smart-Start Decision Flow

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2d1b69',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#11998e',
    'lineColor': '#38ef7d',
    'secondaryColor': '#11998e',
    'tertiaryColor': '#38ef7d',
    'background': '#0f0f23',
    'mainBkg': '#2d1b69',
    'secondBkg': '#11998e',
    'tertiaryBkg': '#38ef7d'
  }
}}%%

flowchart TD
    Start([🧠 smart-start]) --> CheckDeps{🔧 Check Dependencies}
    
    CheckDeps -->|Missing Node| InstallNode[📦 Install Node.js<br/>via nvm]
    CheckDeps -->|Missing Docker| InstallDocker[🐳 Install/Fix Docker]
    CheckDeps -->|All OK| CheckMode{🎯 Detect Mode}
    
    InstallNode --> CheckMode
    InstallDocker --> CheckMode
    
    CheckMode --> TryRegistry{📋 Try Registry Images}
    
    TryRegistry -->|Success| RegistryMode[🏭 Use Pre-built Images<br/>ghcr.io/graphdone/*]
    TryRegistry -->|Fail| CheckLocal{🔍 Check Local Build}
    
    CheckLocal -->|npm exists| LocalMode[🔨 Build from Source<br/>npm run build]
    CheckLocal -->|No npm| DockerMode[🐳 Use Docker Compose<br/>docker-compose up]
    
    RegistryMode --> ConfigureSSL
    LocalMode --> ConfigureSSL
    DockerMode --> ConfigureSSL{🔒 Configure SSL/TLS}
    
    ConfigureSSL -->|Dev| HTTPMode[🌐 HTTP Mode<br/>Port 3127/4127]
    ConfigureSSL -->|Prod| HTTPSMode[🛡️ HTTPS Mode<br/>Port 3128/4128]
    
    HTTPMode --> StartContainers
    HTTPSMode --> StartContainers[🚀 Start Containers]
    
    StartContainers --> WaitHealth[⏳ Wait for Health Checks]
    
    WaitHealth -->|Neo4j Ready| CheckAPI
    WaitHealth -->|Timeout| Retry[🔄 Retry with logs]
    
    CheckAPI{⚡ API Health} -->|Ready| CheckWeb
    CheckAPI -->|Not Ready| ShowAPILogs[📋 Show API logs]
    
    CheckWeb{🌐 Web Health} -->|Ready| Complete[✨ All Systems Go!]
    CheckWeb -->|Not Ready| ShowWebLogs[📋 Show Web logs]
    
    Complete --> DisplayURLs[🎯 Display Access URLs<br/>and Commands]
    
    classDef startStyle fill:#667eea,stroke:#764ba2,stroke-width:4px,color:#ffffff
    classDef processStyle fill:#f6d365,stroke:#fda085,stroke-width:2px,color:#2d1b69
    classDef decisionStyle fill:#a8edea,stroke:#fed6e3,stroke-width:2px,color:#2d1b69
    classDef modeStyle fill:#d299c2,stroke:#fef9d7,stroke-width:2px,color:#ffffff
    classDef successStyle fill:#89f7fe,stroke:#66a6ff,stroke-width:3px,color:#2d1b69
    classDef configStyle fill:#ff9a9e,stroke:#fecfef,stroke-width:2px,color:#ffffff
    
    class Start startStyle
    class InstallNode,InstallDocker,WaitHealth,Retry,ShowAPILogs,ShowWebLogs,DisplayURLs processStyle
    class CheckDeps,CheckMode,TryRegistry,CheckLocal,ConfigureSSL,CheckAPI,CheckWeb decisionStyle
    class RegistryMode,LocalMode,DockerMode,HTTPMode,HTTPSMode modeStyle
    class Complete successStyle
```

## 🏗️ Service Architecture

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'lineColor': '#667EEA',
    'secondaryColor': '#4A5568',
    'tertiaryColor': '#718096',
    'background': '#1A202C',
    'mainBkg': '#2D3748',
    'secondBkg': '#4A5568',
    'tertiaryBkg': '#718096',
    'clusterBkg': '#2D3748',
    'altBackground': '#4A5568'
  }
}}%%

graph TB
    subgraph User ["👤 User's Machine"]
        CLI[💻 curl/wget command]
        Browser[🌐 Web Browser]
    end
    
    subgraph GitHub ["📦 GitHub Ecosystem"]
        Repo[📋 GraphDone-Core Repository]
        Script[🚀 public/start.sh]
        Registry[🏭 ghcr.io Registry]
    end
    
    subgraph Local ["🏠 Local Installation ~/graphdone"]
        SmartStart[🧠 smart-start]
        ENV[⚙️ .env configuration]
        Certs[🔒 TLS Certificates]
        
        subgraph Containers ["🐳 Docker Containers"]
            Neo4j[🗄️ Neo4j Database<br/>:7474/:7687]
            Redis[⚡ Redis Cache<br/>:6379]
            API[🔌 GraphQL API<br/>:4128]
            Web[🌐 Web UI<br/>:3128]
        end
    end
    
    CLI -->|1. 📥 Fetch| Script
    Script -->|2. 📋 Clone| Repo
    Repo -->|3. 🚀 Install| SmartStart
    SmartStart -->|4. 📦 Pull Images| Registry
    SmartStart -->|5. ⚙️ Configure| ENV
    SmartStart -->|6. 🔒 Generate| Certs
    SmartStart -->|7. 🗄️ Start| Neo4j
    SmartStart -->|8. ⚡ Start| Redis
    SmartStart -->|9. 🔌 Start| API
    SmartStart -->|10. 🌐 Start| Web
    
    Browser -->|🔐 HTTPS| Web
    Web -->|📊 GraphQL| API
    API -->|💾 Cypher| Neo4j
    API -->|⚡ Cache| Redis
    
    classDef userStyle fill:#4C51BF,stroke:#667EEA,stroke-width:3px,color:#FFFFFF
    classDef githubStyle fill:#9F7AEA,stroke:#B794F6,stroke-width:2px,color:#FFFFFF
    classDef localStyle fill:#3182CE,stroke:#4299E1,stroke-width:2px,color:#FFFFFF
    classDef containerStyle fill:#38A169,stroke:#48BB78,stroke-width:2px,color:#FFFFFF
    classDef scriptStyle fill:#ED8936,stroke:#F6AD55,stroke-width:3px,color:#FFFFFF
    classDef smartStyle fill:#00B5D8,stroke:#0BC5EA,stroke-width:3px,color:#FFFFFF
    
    class CLI,Browser userStyle
    class Repo,Registry githubStyle
    class ENV,Certs localStyle
    class Neo4j,Redis,API,Web containerStyle
    class Script scriptStyle
    class SmartStart smartStyle
```

## 🔄 Error Recovery Flow

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'lineColor': '#667EEA',
    'secondaryColor': '#4A5568',
    'tertiaryColor': '#718096',
    'background': '#1A202C',
    'mainBkg': '#2D3748',
    'secondBkg': '#4A5568',
    'tertiaryBkg': '#718096',
    'clusterBkg': '#2D3748',
    'altBackground': '#4A5568'
  }
}}%%

flowchart LR
    subgraph Issues ["⚠️ Common Issues"]
        E1[🐳 Docker not running]
        E2[🚪 Port conflict]
        E3[🔒 SSL cert error]
        E4[🌐 Network timeout]
    end
    
    subgraph AutoFix ["🤖 Auto-Recovery"]
        F1[🚀 Start Docker daemon]
        F2[⚡ Kill conflicting process]
        F3[🔄 Regenerate certificates]
        F4[⏳ Retry with timeout]
    end
    
    subgraph Manual ["👤 Manual Recovery"]
        M1[🛑 ./start stop<br/>🧠 ./smart-start]
        M2[🗑️ ./start remove<br/>🧠 ./smart-start]
        M3[📋 Check logs<br/>🐳 docker logs]
    end
    
    E1 --> F1
    E2 --> F2
    E3 --> F3
    E4 --> F4
    
    F1 -->|Fail| M1
    F2 -->|Fail| M1
    F3 -->|Fail| M2
    F4 -->|Fail| M3
    
    classDef errorStyle fill:#E53E3E,stroke:#FC8181,stroke-width:3px,color:#FFFFFF
    classDef autoStyle fill:#38A169,stroke:#68D391,stroke-width:2px,color:#FFFFFF
    classDef manualStyle fill:#3182CE,stroke:#63B3ED,stroke-width:2px,color:#FFFFFF
    
    class E1,E2,E3,E4 errorStyle
    class F1,F2,F3,F4 autoStyle
    class M1,M2,M3 manualStyle
```

## 🚀 Quick Start Options Comparison

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'lineColor': '#667EEA',
    'secondaryColor': '#4A5568',
    'tertiaryColor': '#718096',
    'background': '#1A202C',
    'mainBkg': '#2D3748',
    'secondBkg': '#4A5568',
    'tertiaryBkg': '#718096',
    'clusterBkg': '#2D3748',
    'altBackground': '#4A5568'
  }
}}%%

graph TD
    subgraph Methods ["🛠️ Installation Methods"]
        OneLineCurl[💻 curl one-liner<br/>⚡ Fastest]
        OneLineWget[🐧 wget one-liner<br/>Linux preferred]
        GitClone[👨‍💻 git clone + ./smart-start<br/>Developer mode]
        Docker[🐳 docker compose<br/>Container only]
    end
    
    subgraph Features ["✨ Features"]
        AutoSetup[🤖 Auto setup]
        TLSCerts[🔒 TLS certificates]
        SmartDetect[🧠 Smart detection]
        Registry[📦 Pre-built images]
        LocalBuild[🔨 Local build]
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
    
    classDef recommendedStyle fill:#38A169,stroke:#68D391,stroke-width:4px,color:#FFFFFF
    classDef devStyle fill:#3182CE,stroke:#63B3ED,stroke-width:2px,color:#FFFFFF
    classDef containerStyle fill:#ED8936,stroke:#F6AD55,stroke-width:2px,color:#FFFFFF
    classDef featureStyle fill:#9F7AEA,stroke:#B794F6,stroke-width:2px,color:#FFFFFF
    
    class OneLineCurl,OneLineWget recommendedStyle
    class GitClone devStyle
    class Docker containerStyle
    class AutoSetup,TLSCerts,SmartDetect,Registry,LocalBuild featureStyle
```

## ⏱️ Installation Timeline

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#2D3748',
    'primaryTextColor': '#FFFFFF',
    'primaryBorderColor': '#4A5568',
    'gridColor': '#718096',
    'background': '#1A202C',
    'altBackground': '#2D3748',
    'c0': '#38A169',
    'c1': '#3182CE', 
    'c2': '#9F7AEA',
    'c3': '#ED8936',
    'c4': '#E53E3E',
    'cScale0': '#38A169',
    'cScale1': '#3182CE',
    'cScale2': '#9F7AEA',
    'cScale3': '#ED8936',
    'cScale4': '#E53E3E'
  }
}}%%

gantt
    title 🚀 GraphDone Installation Timeline (~60 seconds)
    dateFormat ss
    axisFormat %Ss
    
    section 📥 Download
    📝 Fetch script           :done, fetch, 00, 1s
    📋 Clone repository       :done, clone, 01, 5s
    
    section ⚙️ Setup  
    🔍 Check requirements     :done, req, 06, 1s
    📄 Create .env           :done, env, 07, 1s
    🔒 Generate certificates  :done, cert, 08, 2s
    
    section 🐳 Docker
    🗄️ Pull Neo4j image      :active, neo4j, 10, 10s
    ⚡ Pull Redis image      :active, redis, 10, 3s
    🔌 Pull API image        :active, api, 10, 8s
    🌐 Pull Web image        :active, web, 10, 8s
    
    section 🚀 Start
    🗄️ Start Neo4j           :crit, startneo, 20, 15s
    ⚡ Start Redis           :startredis, 13, 2s
    🔌 Start API             :startapi, 35, 5s
    🌐 Start Web             :startweb, 40, 3s
    
    section ✅ Verify
    💚 Health checks         :milestone, 43, 5s
    🎯 Ready to use!         :milestone, 48, 0s
```

---

## 🎨 Visual Features

- **🌈 Modern Color Schemes**: Each diagram uses carefully curated color palettes for maximum visual impact
- **🎭 Dark Themes**: Professional dark backgrounds with high contrast text
- **📱 Responsive Design**: Diagrams scale beautifully across devices
- **🎯 Semantic Colors**: Error states (red), success (green), processes (blue/purple gradients)
- **✨ Rich Icons**: Contextual emojis make diagrams instantly readable
- **🔥 Gradient Borders**: Beautiful stroke gradients add depth and professionalism

## 📊 Technical Highlights

- **Custom Mermaid Themes**: Each diagram has unique theming for visual variety
- **Logical Color Coding**: Consistent meaning across all diagrams
- **Professional Typography**: High contrast white text on dark backgrounds
- **Modern Aesthetics**: Inspired by GitHub Dark, VS Code themes, and modern dashboards