import { z } from 'zod';

export const CreateEventSeriesSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(100, 'Title is too long'),
  recurrence: z.string().regex(/^FREQ=/i, 'Invalid recurrence rule. Must start with FREQ='),
  chatId: z.string().optional(), // Passed as string from args
  topicId: z.string().optional(),
});

export const BindAccountSchema = z.object({
  token: z.string().startsWith('sk_', 'Invalid token format. Must start with sk_').min(30, 'Token is too short'),
});

export type CreateEventSeriesDto = z.infer<typeof CreateEventSeriesSchema>;
export type BindAccountDto = z.infer<typeof BindAccountSchema>;
