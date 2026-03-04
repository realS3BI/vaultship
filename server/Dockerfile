FROM ghcr.io/muchobien/pocketbase:latest

# Server bind port (use PORT env at runtime to override)
ENV PORT=8090
# Admin user (set PB_ADMIN_EMAIL + PB_ADMIN_PASSWORD to create/update on startup)
# ENV PB_ADMIN_EMAIL=
# ENV PB_ADMIN_PASSWORD=

COPY pb_migrations /pb/pb_migrations
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8090

ENTRYPOINT ["/entrypoint.sh"]
