import { z } from "zod";
import { HEX_COLOR_RE } from "@/lib/profile-theme";

export const updateProfileSchema = z.object({
  accentColor: z
    .string()
    .regex(HEX_COLOR_RE, "accentColor must be a 6-digit hex color (#rrggbb)"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
