FROM ghcr.io/muchobien/pocketbase:latest

COPY pb_migrations /pb/pb_migrations

EXPOSE 8090

CMD ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090"]
