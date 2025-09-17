# GraphDone Installation Flow

## One-Liner Installation Process

```mermaid
flowchart TD
    Start([User runs curl/wget command]) --> FetchScript[Fetch start.sh from GitHub]
    FetchScript --> CheckReq{Check Requirements}
    
    CheckReq -->|Missing| ReqError[❌ Show missing tools<br/>git, docker]
    CheckReq -->|OK| CheckDir{Check ~/graphdone}
    
    ReqError --> Exit([Exit with instructions])
    
    CheckDir -->|Exists| Update[Pull latest changes<br/>git pull]
    CheckDir -->|Not exists| Clone[Clone repository<br/>from GitHub]
    
    Update --> CheckEnv
    Clone --> CheckEnv{Check .env file}
    
    CheckEnv -->|Exists| CheckCerts
    CheckEnv -->|Missing| CreateEnv[Create .env with<br/>HTTPS configuration]
    
    CreateEnv --> CheckCerts{Check TLS certificates}
    
    CheckCerts -->|Exist| RunSmartStart
    CheckCerts -->|Missing| GenCerts[Generate certificates<br/>with OpenSSL]
    
    GenCerts --> RunSmartStart[Run smart-start]
    
    RunSmartStart --> SmartDetect{Smart Detection}
    
    SmartDetect -->|Registry OK| PullImages[Pull Docker images<br/>from ghcr.io]
    SmartDetect -->|No Registry| LocalBuild[Build locally<br/>with npm]
    
    PullImages --> StartServices
    LocalBuild --> StartServices[Start Services]
    
    StartServices --> CheckHealth{Health Check}
    
    CheckHealth -->|Pass| Success[✅ GraphDone Ready!<br/>https://localhost:3128]
    CheckHealth -->|Fail| ShowLogs[Show troubleshooting<br/>instructions]
    
    style Start fill:#e1f5fe
    style Success fill:#c8e6c9
    style ReqError fill:#ffcdd2
    style Exit fill:#ffcdd2
```

## Smart-Start Decision Flow

```mermaid
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
    
    ConfigureSSL -->|Dev| HTTPMode[HTTP Mode<br/>Port 3127/4127]
    ConfigureSSL -->|Prod| HTTPSMode[HTTPS Mode<br/>Port 3128/4128]
    
    HTTPMode --> StartContainers
    HTTPSMode --> StartContainers[Start Containers]
    
    StartContainers --> WaitHealth[Wait for Health Checks]
    
    WaitHealth -->|Neo4j Ready| CheckAPI
    WaitHealth -->|Timeout| Retry[Retry with logs]
    
    CheckAPI{API Health} -->|Ready| CheckWeb
    CheckAPI -->|Not Ready| ShowAPILogs[Show API logs]
    
    CheckWeb{Web Health} -->|Ready| Complete[✅ All Systems Go!]
    CheckWeb -->|Not Ready| ShowWebLogs[Show Web logs]
    
    Complete --> DisplayURLs[Display Access URLs<br/>and Commands]
    
    style Start fill:#e1f5fe
    style Complete fill:#c8e6c9
    style RegistryMode fill:#fff3e0
    style LocalMode fill:#f3e5f5
    style DockerMode fill:#e8f5e9
    style HTTPSMode fill:#c5e1a5
```

## Service Architecture

```mermaid
graph TB
    subgraph "User's Machine"
        CLI[curl/wget command]
        Browser[Web Browser]
    end
    
    subgraph "GitHub"
        Repo[GraphDone-Core Repository]
        Script[public/start.sh]
        Registry[ghcr.io Registry]
    end
    
    subgraph "Local Installation ~/graphdone"
        SmartStart[smart-start]
        ENV[.env configuration]
        Certs[TLS Certificates]
        
        subgraph "Docker Containers"
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
    
    style Script fill:#ffeb3b
    style SmartStart fill:#4caf50
    style Web fill:#2196f3
    style API fill:#ff9800
```

## Error Recovery Flow

```mermaid
flowchart LR
    subgraph "Common Issues"
        E1[Docker not running]
        E2[Port conflict]
        E3[SSL cert error]
        E4[Network timeout]
    end
    
    subgraph "Auto-Recovery"
        F1[Start Docker daemon]
        F2[Kill conflicting process]
        F3[Regenerate certificates]
        F4[Retry with timeout]
    end
    
    subgraph "Manual Recovery"
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
    
    style E1 fill:#ffcdd2
    style E2 fill:#ffcdd2
    style E3 fill:#ffcdd2
    style E4 fill:#ffcdd2
    style F1 fill:#fff9c4
    style F2 fill:#fff9c4
    style F3 fill:#fff9c4
    style F4 fill:#fff9c4
    style M1 fill:#c8e6c9
    style M2 fill:#c8e6c9
    style M3 fill:#c8e6c9
```

## Quick Start Options Comparison

```mermaid
graph TD
    subgraph "Installation Methods"
        OneLineCurl[curl one-liner<br/>Fastest ⚡]
        OneLineWget[wget one-liner<br/>Linux preferred]
        GitClone[git clone + ./smart-start<br/>Developer mode]
        Docker[docker compose<br/>Container only]
    end
    
    subgraph "Features"
        AutoSetup[✅ Auto setup]
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
    
    style OneLineCurl fill:#4caf50
    style OneLineWget fill:#4caf50
    style GitClone fill:#2196f3
    style Docker fill:#ff9800
```

## Installation Timeline

```mermaid
gantt
    title GraphDone Installation Timeline
    dateFormat ss
    axisFormat %S
    
    section Download
    Fetch script           :done, fetch, 00, 1s
    Clone repository       :done, clone, after fetch, 5s
    
    section Setup
    Check requirements     :done, req, after clone, 1s
    Create .env           :done, env, after req, 1s
    Generate certificates  :done, cert, after env, 2s
    
    section Docker
    Pull Neo4j image      :active, neo4j, after cert, 10s
    Pull Redis image      :active, redis, after cert, 3s
    Pull API image        :active, api, after cert, 8s
    Pull Web image        :active, web, after cert, 8s
    
    section Start
    Start Neo4j           :crit, startneo, after neo4j, 15s
    Start Redis           :startredis, after redis, 2s
    Start API             :startapi, after api startneo, 5s
    Start Web             :startweb, after web startapi, 3s
    
    section Verify
    Health checks         :milestone, after startweb, 5s
```