FROM cypress/included:15.16.0

USER root

ENV DOTNET_ROOT=/usr/share/dotnet \
    PATH="/usr/share/dotnet:${PATH}" \
    TARGET_URLS="https://2025-14-patch.floor2plan.com/Account/Login"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh \
    && bash /tmp/dotnet-install.sh --channel 8.0 --install-dir /usr/share/dotnet \
    && ln -s /usr/share/dotnet/dotnet /usr/bin/dotnet \
    && rm /tmp/dotnet-install.sh

RUN install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
    | gpg --dearmor -o /etc/apt/keyrings/microsoft-edge.gpg \
    && chmod a+r /etc/apt/keyrings/microsoft-edge.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/microsoft-edge.gpg] https://packages.microsoft.com/repos/edge stable main" \
    > /etc/apt/sources.list.d/microsoft-edge.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends microsoft-edge-stable \
    && microsoft-edge-stable --version \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /smoke-tests

COPY package*.json ./
RUN npm ci

COPY Floor2PlanSmokeTests.csproj ./
RUN dotnet restore Floor2PlanSmokeTests.csproj

COPY . .

CMD ["--browser", "edge", "--headed", "--spec", "cypress/e2e/login_smoke.cy.js"]
