import { z } from 'zod';
import { goalSchema, preferenceFlagSchema } from '@uk-energy/shared';

export const formSchema = z.object({
  goal: goalSchema,
  kwh: z.coerce.number().min(0.1).max(200),
  deadline: z.string().optional(),
  preferences: z.array(preferenceFlagSchema),
});

export type ScenarioFormValues = z.infer<typeof formSchema>;
