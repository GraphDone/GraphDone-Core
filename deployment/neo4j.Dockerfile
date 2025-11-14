FROM neo4j:5.26.12

# Set Neo4j configuration (password will be set at runtime via docker-compose)
ENV NEO4J_dbms_security_procedures_unrestricted=gds.*,apoc.*
ENV NEO4J_dbms_security_procedures_allowlist=gds.*,apoc.*
ENV NEO4J_server_config_strict__validation_enabled=false

# The NEO4J_PLUGINS environment variable will automatically download and install plugins on first start
# This is the recommended way for Neo4j 5.x - plugins are installed at runtime, not build time
ENV NEO4J_PLUGINS='["graph-data-science", "apoc"]'

EXPOSE 7474 7687

# Note: Health check will use credentials provided at runtime
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
  CMD echo "RETURN 1;" | cypher-shell -a bolt://localhost:7687 || exit 1