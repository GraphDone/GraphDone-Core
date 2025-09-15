FROM neo4j:5.26.12

# Set Neo4j configuration
ENV NEO4J_AUTH=neo4j/graphdone_password
ENV NEO4J_dbms_security_procedures_unrestricted=gds.*,apoc.*
ENV NEO4J_dbms_security_procedures_allowlist=gds.*,apoc.*
ENV NEO4J_server_config_strict__validation_enabled=false

# The NEO4J_PLUGINS environment variable will automatically download and install plugins on first start
# This is the recommended way for Neo4j 5.x - plugins are installed at runtime, not build time
ENV NEO4J_PLUGINS='["graph-data-science", "apoc"]'

EXPOSE 7474 7687

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
  CMD cypher-shell -u neo4j -p graphdone_password "RETURN 1" || exit 1