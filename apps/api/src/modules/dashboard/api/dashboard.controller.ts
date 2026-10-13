import type { FastifyReply, FastifyRequest } from 'fastify';

import type { LogQuery } from '../../../infrastructure/logging/log-reader.js';
import { collectionResponse, dataResponse } from '../../../shared/http/response.js';
import {
  buildPaginationMeta,
  type PaginationQuery,
} from '../../../shared/pagination/pagination.js';
import type { DashboardService } from '../application/dashboard.service.js';
import type { DashboardLogsQuery } from './dashboard.schema.js';

function toLogQuery(query: DashboardLogsQuery): LogQuery {
  const logQuery: LogQuery = {
    page: query.page,
    pageSize: query.pageSize,
  };
  if (query.level !== undefined && query.level.length > 0) {
    logQuery.level = query.level;
  }
  if (query.jobId !== undefined && query.jobId.length > 0) {
    logQuery.jobId = query.jobId;
  }
  if (query.q !== undefined && query.q.length > 0) {
    logQuery.q = query.q;
  }
  return logQuery;
}

export function createDashboardController(service: DashboardService): {
  summary: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  listImports: (
    request: FastifyRequest<{ Querystring: PaginationQuery }>,
    reply: FastifyReply,
  ) => Promise<void>;
  getImport: (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => Promise<void>;
  usage: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  logs: (
    request: FastifyRequest<{ Querystring: DashboardLogsQuery }>,
    reply: FastifyReply,
  ) => Promise<void>;
} {
  return {
    summary: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      reply.send(dataResponse(await service.summary()));
    },

    listImports: async (
      request: FastifyRequest<{ Querystring: PaginationQuery }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const { items, total } = await service.listImports(
        request.query.page,
        request.query.pageSize,
      );
      reply.send(collectionResponse(items, buildPaginationMeta(request.query, total)));
    },

    getImport: async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ): Promise<void> => {
      reply.send(dataResponse(await service.getImport(request.params.id)));
    },

    usage: async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      reply.send(dataResponse(await service.usage()));
    },

    logs: async (
      request: FastifyRequest<{ Querystring: DashboardLogsQuery }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const { entries, total } = await service.logs(toLogQuery(request.query));
      reply.send(collectionResponse(entries, buildPaginationMeta(request.query, total)));
    },
  };
}
