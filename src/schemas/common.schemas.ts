import { z } from "zod";

export const idSchema = z.string().uuid();

export const paginatedQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
