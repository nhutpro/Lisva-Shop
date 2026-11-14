import { z } from "zod";

export const specSchema = z.object({
  key: z.string().min(1),
  labelVi: z.string().min(1),
  labelEn: z.string().optional(),
  valueVi: z.string().min(1),
  valueEn: z.string().optional(),
});

export const specsSchema = z.array(specSchema);

export type Spec = z.infer<typeof specSchema>;
