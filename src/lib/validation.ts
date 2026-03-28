import { z } from "zod"

export const emailSchema = z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address")

export const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

export const authRegisterSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Name is required")
        .max(100, "Name is too long"),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["VENDOR", "SUPPLIER"]),
})

export const authLoginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, "Password is required"),
    mfaCode: z.string().trim().length(6, "Verification code must be 6 digits").optional(),
})

export const accountUpdateSchema = z.object({
    businessName: z.string().trim().max(200).optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema.optional(),
}).superRefine((data, ctx) => {
    if (data.newPassword && !data.currentPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["currentPassword"],
            message: "Current password is required to change password",
        })
    }
})

export function isStrongPassword(password: string): boolean {
    const result = passwordSchema.safeParse(password)
    return result.success
}

