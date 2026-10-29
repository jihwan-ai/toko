FROM oven/bun:1.3-debian
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV HOME=/app PORT=8080 HOST=0.0.0.0
COPY package.json plaza.ts ./
RUN mkdir -p /app/.claude && chown -R 1000:1000 /app
USER 1000
EXPOSE 8080
CMD ["bun", "run", "plaza.ts"]
