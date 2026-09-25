FROM public.ecr.aws/lambda/nodejs:22 AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY src/lib/rag ./src/lib/rag
COPY lambdas ./lambdas
COPY scripts/build-rag.mjs ./scripts/build-rag.mjs
RUN node scripts/build-rag.mjs && npm prune --omit=dev

FROM public.ecr.aws/lambda/nodejs:22
COPY --from=build /build/node_modules ${LAMBDA_TASK_ROOT}/node_modules
COPY --from=build /build/build/rag/ ${LAMBDA_TASK_ROOT}/
CMD ["orchestrator.handler"]
