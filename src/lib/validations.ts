/**
 * Input Validation Schemas
 * Zod schemas for type-safe validation across the application
 */

import { z } from 'zod'
import { VideoCategory, VideoVisibility, UserRole, LikeType, PlaylistVisibility } from '@/generated/prisma'

// ===== USER VALIDATIONS =====

export const userRegistrationSchema = z.object({
  email: z
    .string()
    .min(1, 'E-Mail ist erforderlich')
    .email('Ungültige E-Mail-Adresse')
    .max(255, 'E-Mail ist zu lang'),
  
  username: z
    .string()
    .min(3, 'Benutzername muss mindestens 3 Zeichen lang sein')
    .max(30, 'Benutzername darf maximal 30 Zeichen lang sein')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten'),
  
  password: z
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen lang sein')
    .max(100, 'Passwort ist zu lang')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Passwort muss mindestens einen Kleinbuchstaben, einen Großbuchstaben und eine Zahl enthalten'),
  
  displayName: z
    .string()
    .min(1, 'Anzeigename ist erforderlich')
    .max(50, 'Anzeigename ist zu lang')
    .optional(),
  
  firstName: z.string().max(50, 'Vorname ist zu lang').optional(),
  lastName: z.string().max(50, 'Nachname ist zu lang').optional(),
})

export const userLoginSchema = z.object({
  email: z.string().min(1, 'E-Mail ist erforderlich').email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
})

export const userProfileUpdateSchema = z.object({
  displayName: z.string().min(1, 'Anzeigename ist erforderlich').max(50, 'Anzeigename ist zu lang').optional(),
  firstName: z.string().max(50, 'Vorname ist zu lang').optional(),
  lastName: z.string().max(50, 'Nachname ist zu lang').optional(),
  bio: z.string().max(500, 'Bio ist zu lang').optional(),
  websiteUrl: z.string().url('Ungültige URL').optional().or(z.literal('')),
})

export const passwordResetSchema = z.object({
  email: z.string().min(1, 'E-Mail ist erforderlich').email('Ungültige E-Mail-Adresse'),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
  newPassword: z
    .string()
    .min(8, 'Neues Passwort muss mindestens 8 Zeichen lang sein')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Passwort muss mindestens einen Kleinbuchstaben, einen Großbuchstaben und eine Zahl enthalten'),
  confirmPassword: z.string().min(1, 'Passwort bestätigen ist erforderlich'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
})

// ===== VIDEO VALIDATIONS =====

export const videoUploadSchema = z.object({
  title: z
    .string()
    .min(1, 'Titel ist erforderlich')
    .max(100, 'Titel ist zu lang'),
  
  description: z
    .string()
    .max(5000, 'Beschreibung ist zu lang')
    .optional(),
  
  tags: z
    .array(z.string().min(1).max(50))
    .max(10, 'Maximal 10 Tags erlaubt')
    .optional()
    .default([]),
  
  category: z
    .nativeEnum(VideoCategory)
    .optional(),
  
  visibility: z
    .nativeEnum(VideoVisibility)
    .default(VideoVisibility.PUBLIC),
  
  language: z
    .string()
    .min(2, 'Sprache muss mindestens 2 Zeichen lang sein')
    .max(5, 'Sprache darf maximal 5 Zeichen lang sein')
    .default('de'),
  
  ageRestricted: z
    .boolean()
    .default(false),
  
  commentsEnabled: z
    .boolean()
    .default(true),
  
  scheduledAt: z
    .string()
    .datetime()
    .optional()
    .or(z.literal('')),
})

export const videoUpdateSchema = videoUploadSchema.partial()

export const videoLikeSchema = z.object({
  videoId: z.string().min(1, 'Video-ID ist erforderlich'),
  type: z.nativeEnum(LikeType),
})

// ===== COMMENT VALIDATIONS =====

export const commentCreateSchema = z.object({
  content: z
    .string()
    .min(1, 'Kommentar darf nicht leer sein')
    .max(1000, 'Kommentar ist zu lang'),
  
  videoId: z.string().min(1, 'Video-ID ist erforderlich'),
  parentId: z.string().optional(), // For replies
})

export const commentUpdateSchema = z.object({
  content: z
    .string()
    .min(1, 'Kommentar darf nicht leer sein')
    .max(1000, 'Kommentar ist zu lang'),
})

export const commentLikeSchema = z.object({
  commentId: z.string().min(1, 'Kommentar-ID ist erforderlich'),
  type: z.nativeEnum(LikeType),
})

// ===== PLAYLIST VALIDATIONS =====

export const playlistCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'Titel ist erforderlich')
    .max(100, 'Titel ist zu lang'),
  
  description: z
    .string()
    .max(1000, 'Beschreibung ist zu lang')
    .optional(),
  
  visibility: z
    .nativeEnum(PlaylistVisibility)
    .default(PlaylistVisibility.PUBLIC),
})

export const playlistUpdateSchema = playlistCreateSchema.partial()

export const playlistVideoSchema = z.object({
  playlistId: z.string().min(1, 'Playlist-ID ist erforderlich'),
  videoId: z.string().min(1, 'Video-ID ist erforderlich'),
  position: z.number().int().min(0, 'Position muss eine positive Zahl sein').optional(),
})

// ===== SEARCH & PAGINATION =====

export const searchSchema = z.object({
  q: z.string().min(1, 'Suchbegriff ist erforderlich').max(100, 'Suchbegriff ist zu lang').optional(),
  category: z.nativeEnum(VideoCategory).optional(),
  duration: z.enum(['short', 'medium', 'long']).optional(), // <4min, 4-20min, >20min
  uploadDate: z.enum(['hour', 'today', 'week', 'month', 'year']).optional(),
  sortBy: z.enum(['relevance', 'date', 'views', 'rating']).default('relevance'),
  page: z.number().int().min(1, 'Seitenzahl muss mindestens 1 sein').default(1),
  limit: z.number().int().min(1, 'Limit muss mindestens 1 sein').max(50, 'Limit darf maximal 50 sein').default(20),
})

export const paginationSchema = z.object({
  page: z.number().int().min(1, 'Seitenzahl muss mindestens 1 sein').default(1),
  limit: z.number().int().min(1, 'Limit muss mindestens 1 sein').max(100, 'Limit darf maximal 100 sein').default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// ===== ADMIN VALIDATIONS =====

export const userRoleUpdateSchema = z.object({
  userId: z.string().min(1, 'Benutzer-ID ist erforderlich'),
  role: z.nativeEnum(UserRole),
})

export const userStatusUpdateSchema = z.object({
  userId: z.string().min(1, 'Benutzer-ID ist erforderlich'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().max(500, 'Grund ist zu lang').optional(),
})

// ===== FILE UPLOAD VALIDATIONS =====

export const fileUploadSchema = z.object({
  file: z.any().refine(
    (file) => file?.size <= (parseInt(process.env.MAX_FILE_SIZE || '500') * 1024 * 1024),
    'Datei ist zu groß'
  ).refine(
    (file) => {
      const allowedTypes = process.env.ALLOWED_VIDEO_FORMATS?.split(',') || ['mp4', 'avi', 'mov']
      const fileExtension = file?.name?.split('.').pop()?.toLowerCase()
      return allowedTypes.includes(fileExtension)
    },
    'Dateityp ist nicht erlaubt'
  ),
})

// ===== API RESPONSE TYPES =====

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  timestamp: z.string().datetime(),
})

export const apiSuccessSchema = z.object({
  success: z.boolean().default(true),
  message: z.string().optional(),
  data: z.any().optional(),
})

// Type exports for TypeScript
export type UserRegistration = z.infer<typeof userRegistrationSchema>
export type UserLogin = z.infer<typeof userLoginSchema>
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>
export type VideoUpload = z.infer<typeof videoUploadSchema>
export type VideoUpdate = z.infer<typeof videoUpdateSchema>
export type CommentCreate = z.infer<typeof commentCreateSchema>
export type CommentUpdate = z.infer<typeof commentUpdateSchema>
export type PlaylistCreate = z.infer<typeof playlistCreateSchema>
export type PlaylistUpdate = z.infer<typeof playlistUpdateSchema>
export type SearchQuery = z.infer<typeof searchSchema>
export type PaginationQuery = z.infer<typeof paginationSchema>
export type ApiError = z.infer<typeof apiErrorSchema>
export type ApiSuccess = z.infer<typeof apiSuccessSchema>