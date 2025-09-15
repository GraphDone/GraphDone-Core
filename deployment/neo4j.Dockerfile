FROM neo4j:5.26.12

# Pre-install plugins to speed up startup
ENV NEO4J_PLUGINS='["graph-data-science", "apoc"]'
ENV NEO4J_AUTH=neo4j/graphdone_password
ENV NEO4J_dbms_security_procedures_unrestricted=gds.*,apoc.*
ENV NEO4J_dbms_security_procedures_allowlist=gds.*,apoc.*
ENV NEO4J_server_config_strict__validation_enabled=false

# Pre-download and install plugins during build
RUN neo4j-admin server plugin install graph-data-science --accept-license && \
    neo4j-admin server plugin install apoc --accept-license

# Pre-create the database to speed up first start
RUN neo4j-admin database create neo4j || true

EXPOSE 7474 7687

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
  CMD cypher-shell -u neo4j -p graphdone_password "RETURN 1" || exit 1