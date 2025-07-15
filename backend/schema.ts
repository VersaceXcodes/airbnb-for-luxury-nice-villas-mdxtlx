import { z } from 'zod';

// =================================================================
// ENUMS & CONSTANT VALUES
// =================================================================

// User role enum
export const USER_ROLES = ['guest', 'host', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];
export const UserRoleEnum = z.enum(USER_ROLES);

// Villa status enum
export const VILLA_STATUSES = ['draft', 'under_review', 'live', 'suspended'] as const;
export type VillaStatus = typeof VILLA_STATUSES[number];
export const VillaStatusEnum = z.enum(VILLA_STATUSES);

// Booking status enum
export const BOOKING_STATUSES = ['inquiry', 'in_progress', 'confirmed', 'cancelled', 'completed'] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];
export const BookingStatusEnum = z.enum(BOOKING_STATUSES);

// Room type enum
export const ROOM_TYPES = ['bedroom', 'bathroom', 'living_area', 'pool'] as const;
export type RoomType = typeof ROOM_TYPES[number];
export const RoomTypeEnum = z.enum(ROOM_TYPES);

// Event type enum
export const EVENT_TYPES = ['blocked', 'booking', 'manual_hold'] as const;
export type CalendarEventType = typeof EVENT_TYPES[number];
export const CalendarEventTypeEnum = z.enum(EVENT_TYPES);

// Rule type enum
export const RULE_TYPES = ['season', 'weekend', 'event', 'min_stay', 'discount_week', 'discount_month'] as const;
export type RuleType = typeof RULE_TYPES[number];
export const RuleTypeEnum = z.enum(RULE_TYPES);

// Inquiry status enum
export const INQUIRY_STATUSES = ['pending', 'accepted', 'declined', 'expired'] as const;
export type InquiryStatus = typeof INQUIRY_STATUSES[number];
export const InquiryStatusEnum = z.enum(INQUIRY_STATUSES);

// Ticket department enum
export const TICKET_DEPARTMENTS = ['guest_support', 'host_support', 'ops'] as const;
export type TicketDepartment = typeof TICKET_DEPARTMENTS[number];
export const TicketDepartmentEnum = z.enum(TICKET_DEPARTMENTS);

// Ticket priority enum
export const TICKET_PRIORITIES = ['low', 'high', 'urgent'] as const;
export type TicketPriority = typeof TICKET_PRIORITIES[number];
export const TicketPriorityEnum = z.enum(TICKET_PRIORITIES);

// Payment status enum
export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed', 'refunded'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export const PaymentStatusEnum = z.enum(PAYMENT_STATUSES);

// Damage report status enum
export const DAMAGE_STATUSES = ['open', 'resolved', 'closed', 'disputed'] as const;
export type DamageReportStatus = typeof DAMAGE_STATUSES[number];
export const DamageStatusEnum = z.enum(DAMAGE_STATUSES);

// Payout status enum
export const PAYOUT_STATUSES = ['scheduled', 'paid', 'failed'] as const;
export type PayoutStatus = typeof PAYOUT_STATUSES[number];
export const PayoutStatusEnum = z.enum(PAYOUT_STATUSES);

// Guidebook purpose enum
export const UPLOAD_PURPOSES = ['villa_photo', 'guidebook_pdf', 'contract_pdf', 'damage_evidence'] as const;
export type UploadPurpose = typeof UPLOAD_PURPOSES[number];
export const UploadPurposeEnum = z.enum(UPLOAD_PURPOSES);

// =================================================================
// BASE ENTITIES
// =================================================================

// JSON schemas
const locationDataSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  city: z.string(),
  address: z.string(),
  postal_code: z.string(),
  country: z.string()
});

const policiesSchema = z.object({
  cancellation_tier: z.string(),
  security_deposit_usd: z.number(),
  house_rules: z.array(z.string()),
  checkin_time: z.string(),
  checkout_time: z.string()
});

const bedSchema = z.object({
  type: z.string(),
  count: z.number().int().positive()
});

const ratingsSchema = z.object({
  accuracy: z.number().int().min(1).max(5),
  cleanliness: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  location: z.number().int().min(1).max(5),
  value: z.number().int().min(1).max(5)
});

// =================================================================
// USERS SCHEMAS
// =================================================================

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  phone_e164: z.string().nullable(),
  hashed_password: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  role: UserRoleEnum,
  onboarding_step: z.number().int().nonnegative(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
  audit_meta: z.any().nullable()
});

export const createUserInputSchema = z.object({
  email: z.string().email(),
  phone_e164: z.string().nullable(),
  hashed_password: z.string().min(8),
  first_name: z.string().min(1).max(255),
  last_name: z.string().min(1).max(255),
  display_name: z.string().min(1).max(255),
  avatar_url: z.string().url().nullable().optional(),
  role: UserRoleEnum
});

export const updateUserInputSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  phone_e164: z.string().nullable().optional(),
  hashed_password: z.string().min(8).optional(),
  first_name: z.string().min(1).max(255).optional(),
  last_name: z.string().min(1).max(255).optional(),
  display_name: z.string().min(1).max(255).optional(),
  avatar_url: z.string().url().nullable().optional(),
  role: UserRoleEnum.optional(),
  onboarding_step: z.number().int().nonnegative().optional()
});

export const searchUserInputSchema = z.object({
  query: z.string().optional(),
  role: UserRoleEnum.optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'email', 'first_name']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// =================================================================
// USER SESSIONS SCHEMAS
// =================================================================

export const userSessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  expires_at: z.coerce.date(),
  ip: z.string().nullable(),
  user_agent: z.string().nullable()
});

export const createUserSessionInputSchema = z.object({
  user_id: z.string(),
  expires_at: z.coerce.date(),
  ip: z.string().optional(),
  user_agent: z.string().optional()
});

export const updateUserSessionInputSchema = z.object({
  id: z.string(),
  expires_at: z.coerce.date().optional(),
  ip: z.string().optional(),
  user_agent: z.string().optional()
});

// =================================================================
// VILLAS SCHEMAS
// =================================================================

export const villaSchema = z.object({
  id: z.string(),
  host_user_id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  location_data: locationDataSchema,
  bedrooms_total: z.number().int().positive(),
  bathrooms_total: z.number().int().positive(),
  max_guests: z.number().int().positive(),
  max_pets: z.number().int().nonnegative().default(0),
  policies: policiesSchema,
  base_price_usd_per_night: z.number().positive(),
  cleaning_fee_usd: z.number().nonnegative(),
  service_fee_ratio: z.number().nonnegative(),
  damage_waiver_ratio: z.number().nonnegative(),
  published: z.boolean().default(false),
  status: VillaStatusEnum,
  search_text_vector: z.string().nullable(),
  tags_array: z.array(z.string()).nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
  audit_meta: z.any().nullable()
});

export const createVillaInputSchema = z.object({
  host_user_id: z.string(),
  slug: z.string().min(1).max(255),
  title: z.string().min(1).max(500),
  description: z.string().min(10),
  location_data: locationDataSchema,
  bedrooms_total: z.number().int().positive(),
  bathrooms_total: z.number().int().positive(),
  max_guests: z.number().int().positive(),
  max_pets: z.number().int().nonnegative().optional(),
  policies: policiesSchema,
  base_price_usd_per_night: z.number().positive(),
  cleaning_fee_usd: z.number().nonnegative(),
  service_fee_ratio: z.number().nonnegative().max(1),
  damage_waiver_ratio: z.number().nonnegative().max(1),
  status: VillaStatusEnum
});

export const updateVillaInputSchema = z.object({
  id: z.string(),
  slug: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(10).optional(),
  location_data: locationDataSchema.optional(),
  bedrooms_total: z.number().int().positive().optional(),
  bathrooms_total: z.number().int().positive().optional(),
  max_guests: z.number().int().positive().optional(),
  max_pets: z.number().int().nonnegative().optional(),
  policies: policiesSchema.optional(),
  base_price_usd_per_night: z.number().positive().optional(),
  cleaning_fee_usd: z.number().nonnegative().optional(),
  service_fee_ratio: z.number().nonnegative().max(1).optional(),
  damage_waiver_ratio: z.number().nonnegative().max(1).optional(),
  published: z.boolean().optional(),
  status: VillaStatusEnum.optional()
});

export const searchVillaInputSchema = z.object({
  query: z.string().optional(),
  min_guests: z.number().int().positive().optional(),
  max_price: z.number().positive().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
  published_only: z.boolean().default(true),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['price', 'max_guests', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// =================================================================
// ROOM TYPES SCHEMAS
// =================================================================

export const roomTypeSchema = z.object({
  id: z.string(),
  villa_id: z.string(),
  type: RoomTypeEnum,
  name: z.string(),
  beds_json: z.array(bedSchema).nullable()
});

export const createRoomTypeInputSchema = z.object({
  villa_id: z.string(),
  type: RoomTypeEnum,
  name: z.string().min(1).max(255),
  beds_json: z.array(bedSchema).optional()
});

export const updateRoomTypeInputSchema = z.object({
  id: z.string(),
  type: RoomTypeEnum.optional(),
  name: z.string().min(1).max(255).optional(),
  beds_json: z.array(bedSchema).optional()
});

// =================================================================
// AMENITIES SCHEMAS
// =================================================================

export const amenitySchema = z.object({
  id: z.string(),
  villa_id: z.string(),
  amenity_key: z.string(),
  value: z.boolean(),
  note: z.string().nullable()
});

export const createAmenityInputSchema = z.object({
  villa_id: z.string(),
  amenity_key: z.string().min(1).max(100),
  value: z.boolean(),
  note: z.string().optional()
});

export const updateAmenityInputSchema = z.object({
  id: z.string(),
  value: z.boolean().optional(),
  note: z.string().nullable().optional()
});

// =================================================================
// BOOKINGS SCHEMAS
// =================================================================

export const bookingSchema = z.object({
  id: z.string(),
  guest_user_id: z.string(),
  villa_id: z.string(),
  check_in: z.coerce.date(),
  check_out: z.coerce.date(),
  adults: z.number().int().positive(),
  children: z.number().int().nonnegative(),
  infants: z.number().int().nonnegative(),
  total_base_usd: z.number().nonnegative(),
  total_fees_usd: z.number().nonnegative(),
  total_taxes_usd: z.number().nonnegative(),
  total_usd: z.number().nonnegative(),
  balance_usd: z.number(),
  status: BookingStatusEnum,
  contract_signed_at: z.coerce.date().nullable(),
  contract_pdf_url: z.string().nullable(),
  payment_intent_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable()
});

export const createBookingInputSchema = z.object({
  guest_user_id: z.string(),
  villa_id: z.string(),
  check_in: z.coerce.date(),
  check_out: z.coerce.date(),
  adults: z.number().int().positive().max(99),
  children: z.number().int().nonnegative().max(99),
  infants: z.number().int().nonnegative().max(99)
}).refine(data => data.check_out > data.check_in, {
  message: "Check-out must be after check-in"
});

export const updateBookingInputSchema = z.object({
  id: z.string(),
  check_in: z.coerce.date().optional(),
  check_out: z.coerce.date().optional(),
  adults: z.number().int().positive().max(99).optional(),
  children: z.number().int().nonnegative().max(99).optional(),
  infants: z.number().int().nonnegative().max(99).optional(),
  status: BookingStatusEnum.optional(),
  contract_signed_at: z.coerce.date().nullable().optional(),
  contract_pdf_url: z.string().nullable().optional(),
  payment_intent_id: z.string().nullable().optional()
}).refine(data => 
  !data.check_in || !data.check_out || data.check_out > data.check_in, {
  message: "Check-out must be after check-in"
});

export const searchBookingInputSchema = z.object({
  guest_user_id: z.string().optional(),
  villa_id: z.string().optional(),
  status: BookingStatusEnum.optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['check_in', 'check_out', 'total_usd', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// =================================================================
// BOOKING ADDONS SCHEMAS
// =================================================================

export const bookingAddonSchema = z.object({
  booking_id: z.string(),
  addon_key: z.string(),
  units: z.number().int().positive(),
  price_per_unit_usd: z.number().nonnegative(),
  total_usd: z.number().nonnegative()
});

export const createBookingAddonInputSchema = z.object({
  booking_id: z.string(),
  addon_key: z.string().min(1),
  units: z.number().int().positive(),
  price_per_unit_usd: z.number().nonnegative()
});

export const updateBookingAddonInputSchema = z.object({
  booking_id: z.string(),
  addon_key: z.string(),
  units: z.number().int().positive().optional(),
  price_per_unit_usd: z.number().nonnegative().optional()
});

// =================================================================
// PAYMENTS SCHEMAS
// =================================================================

export const paymentSchema = z.object({
  id: z.string(),
  booking_id: z.string(),
  charge_id: z.string(),
  charged_amount_usd: z.number().nonnegative(),
  refunded_amount_usd: z.number().nonnegative().default(0),
  currency: z.string().min(3).max(3).toUpperCase(),
  status: PaymentStatusEnum,
  created_at: z.coerce.date()
});

export const createPaymentInputSchema = z.object({
  booking_id: z.string(),
  charge_id: z.string(),
  charged_amount_usd: z.number().positive(),
  currency: z.string().min(3).max(3)
});

export const updatePaymentInputSchema = z.object({
  id: z.string(),
  refunded_amount_usd: z.number().nonnegative().optional(),
  status: PaymentStatusEnum.optional()
});

// =================================================================
// CALENDAR EVENTS SCHEMAS
// =================================================================

export const calendarEventSchema = z.object({
  id: z.string(),
  villa_id: z.string(),
  event_type: CalendarEventTypeEnum,
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  booking_id: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createCalendarEventInputSchema = z.object({
  villa_id: z.string(),
  event_type: CalendarEventTypeEnum,
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  booking_id: z.string().optional(),
  note: z.string().optional()
}).refine(data => data.end_date > data.start_date, {
  message: "End date must be after start date"
});

export const updateCalendarEventInputSchema = z.object({
  id: z.string(),
  event_type: CalendarEventTypeEnum.optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  booking_id: z.string().optional(),
  note: z.string().optional()
});

// =================================================================
// PRICING RULES SCHEMAS
// =================================================================

export const pricingRuleSchema = z.object({
  id: z.string(),
  villa_id: z.string(),
  rule_type: RuleTypeEnum,
  start_date: z.coerce.date().nullable(),
  end_date: z.coerce.date().nullable(),
  adjustment_fixed_usd: z.number().optional(),
  adjustment_percent: z.number().optional(),
  min_nights: z.number().int().positive().optional(),
  priority: z.number().int().positive(),
  created_at: z.coerce.date()
});

export const createPricingRuleInputSchema = z.object({
  villa_id: z.string(),
  rule_type: RuleTypeEnum,
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  adjustment_fixed_usd: z.number().optional(),
  adjustment_percent: z.number().min(-100).max(100).optional(),
  min_nights: z.number().int().positive().optional(),
  priority: z.number().int().positive().default(10)
}).refine(data => data.start_date && data.end_date ? data.end_date >= data.start_date : true, {
  message: "End date must be after or equal to start date"
});

export const updatePricingRuleInputSchema = z.object({
  id: z.string(),
  rule_type: RuleTypeEnum.optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  adjustment_fixed_usd: z.number().optional(),
  adjustment_percent: z.number().min(-100).max(100).optional(),
  min_nights: z.number().int().positive().optional(),
  priority: z.number().int().positive().optional()
});

// =================================================================
// INQUIRIES SCHEMAS
// =================================================================

export const inquirySchema = z.object({
  id: z.string(),
  guest_user_id: z.string(),
  villa_id: z.string(),
  message: z.string(),
  requested_check_in: z.coerce.date(),
  requested_check_out: z.coerce.date(),
  status: InquiryStatusEnum,
  response_price_change: z.number().nullable(),
  response_message: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createInquiryInputSchema = z.object({
  guest_user_id: z.string(),
  villa_id: z.string(),
  message: z.string().min(10).max(2000),
  requested_check_in: z.coerce.date(),
  requested_check_out: z.coerce.date()
}).refine(data => data.requested_check_out > data.requested_check_in, {
  message: "Check-out must be after check-in"
});

export const updateInquiryInputSchema = z.object({
  id: z.string(),
  message: z.string().min(10).max(2000).optional(),
  status: InquiryStatusEnum.optional(),
  response_price_change: z.number().optional(),
  response_message: z.string().optional()
});

// =================================================================
// MESSAGES SCHEMAS
// =================================================================

export const messageSchema = z.object({
  id: z.string(),
  booking_id: z.string().nullable(),
  sender_user_id: z.string(),
  body: z.string(),
  sent_at: z.coerce.date(),
  read_at: z.coerce.date().nullable()
});

export const createMessageInputSchema = z.object({
  booking_id: z.string().optional(),
  sender_user_id: z.string(),
  body: z.string().min(1).max(5000)
});

export const updateMessageInputSchema = z.object({
  id: z.string(),
  read_at: z.coerce.date().optional()
});

// =================================================================
// REVIEWS SCHEMAS
// =================================================================

export const guestReviewSchema = z.object({
  id: z.string(),
  booking_id: z.string(),
  guest_user_id: z.string(),
  villa_id: z.string(),
  ratings: ratingsSchema,
  content: z.string(),
  photos: z.array(z.string()).nullable(),
  created_at: z.coerce.date()
});

export const createGuestReviewInputSchema = z.object({
  booking_id: z.string(),
  villa_id: z.string(),
  ratings: ratingsSchema,
  content: z.string().min(10).max(2000),
  photos: z.array(z.string().url()).optional()
});

export const hostReviewSchema = z.object({
  id: z.string(),
  booking_id: z.string(),
  host_user_id: z.string(),
  guest_user_id: z.string(),
  ratings: ratingsSchema,
  content: z.string(),
  created_at: z.coerce.date()
});

export const createHostReviewInputSchema = z.object({
  booking_id: z.string(),
  guest_user_id: z.string(),
  ratings: ratingsSchema,
  content: z.string().min(10).max(2000)
});

// =================================================================
// LOYALTY CREDITS SCHEMAS
// =================================================================

export const loyaltyCreditSchema = z.object({
  id: z.string(),
  guest_user_id: z.string(),
  booking_id: z.string(),
  amount_usd: z.number().positive(),
  expires_at: z.coerce.date(),
  redeemed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export const createLoyaltyCreditInputSchema = z.object({
  guest_user_id: z.string(),
  booking_id: z.string(),
  amount_usd: z.number().positive(),
  expires_at: z.coerce.date()
});

// =================================================================
// HOSTS SCHEMAS
// =================================================================

export const hostSchema = z.object({
  user_id: z.string(),
  company_name: z.string().nullable(),
  payout_currency: z.string().default('usd'),
  payout_schedule: z.enum(['daily', 'weekly', 'monthly']),
  stripe_account_id: z.string().nullable(),
  onboarding_complete: z.boolean().default(false)
});

export const createHostInputSchema = z.object({
  user_id: z.string(),
  company_name: z.string().optional(),
  payout_schedule: z.enum(['daily', 'weekly', 'monthly']),
  stripe_account_id: z.string().optional()
});

export const updateHostInputSchema = z.object({
  user_id: z.string(),
  company_name: z.string().optional(),
  payout_schedule: z.enum(['daily', 'weekly', 'monthly']).optional(),
  stripe_account_id: z.string().optional(),
  onboarding_complete: z.boolean().optional()
});

// =================================================================
// PAYOUTS SCHEMAS
// =================================================================

export const payoutSchema = z.object({
  id: z.string(),
  host_user_id: z.string(),
  stripe_payout_id: z.string(),
  amount_usd: z.number().positive(),
  status: PayoutStatusEnum,
  transaction_ids: z.array(z.string()),
  payout_date: z.coerce.date(),
  created_at: z.coerce.date()
});

export const createPayoutInputSchema = z.object({
  host_user_id: z.string(),
  stripe_payout_id: z.string(),
  amount_usd: z.number().positive(),
  transaction_ids: z.array(z.string()),
  payout_date: z.coerce.date()
});

export const updatePayoutInputSchema = z.object({
  id: z.string(),
  status: PayoutStatusEnum.optional()
});

// =================================================================
// DAMAGE REPORTS SCHEMAS
// =================================================================

export const damageReportSchema = z.object({
  id: z.string(),
  booking_id: z.string(),
  reporter_user_id: z.string(),
  damage_description: z.string(),
  estimated_cost_usd: z.number().nonnegative(),
  photos: z.array(z.string()).nullable(),
  status: DamageStatusEnum,
  created_at: z.coerce.date()
});

export const createDamageReportInputSchema = z.object({
  booking_id: z.string(),
  reporter_user_id: z.string(),
  damage_description: z.string().min(10).max(2000),
  estimated_cost_usd: z.number().nonnegative(),
  photos: z.array(z.string().url()).optional()
});

export const updateDamageReportInputSchema = z.object({
  id: z.string(),
  damage_description: z.string().min(10).max(2000).optional(),
  estimated_cost_usd: z.number().nonnegative().optional(),
  photos: z.array(z.string().url()).optional(),
  status: DamageStatusEnum.optional()
});

// =================================================================
// MODERATION QUEUES SCHEMAS
// =================================================================

export const moderationQueueSchema = z.object({
  id: z.string(),
  villa_id: z.string(),
  queue_name: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  notes: z.string().nullable(),
  assigned_admin_user_id: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createModerationQueueInputSchema = z.object({
  villa_id: z.string(),
  queue_name: z.string().min(1).max(100),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  notes: z.string().optional(),
  assigned_admin_user_id: z.string().optional()
});

export const updateModerationQueueInputSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  notes: z.string().optional(),
  assigned_admin_user_id: z.string().optional()
});

// =================================================================
// TICKETS SCHEMAS
// =================================================================

export const ticketSchema = z.object({
  id: z.string(),
  subject: z.string(),
  reporter_user_id: z.string(),
  booking_id: z.string().nullable(),
  department: TicketDepartmentEnum,
  priority: TicketPriorityEnum,
  assigned_user_id: z.string().nullable(),
  status: z.enum(['open', 'closed', 'escalated']),
  responses: z.array(z.any()),
  created_at: z.coerce.date()
});

export const createTicketInputSchema = z.object({
  subject: z.string().min(5).max(255),
  reporter_user_id: z.string(),
  booking_id: z.string().optional(),
  department: TicketDepartmentEnum,
  priority: TicketPriorityEnum.default('medium'),
  assigned_user_id: z.string().optional()
});

export const updateTicketInputSchema = z.object({
  id: z.string(),
  subject: z.string().min(5).max(255).optional(),
  priority: TicketPriorityEnum.optional(),
  assigned_user_id: z.string().optional(),
  status: z.enum(['open', 'closed', 'escalated']).optional()
});

// =================================================================
// CMS PAGES SCHEMAS
// =================================================================

export const cmsPageSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  body_md: z.string(),
  published: z.boolean().default(false),
  updated_at: z.coerce.date()
});

export const createCmsPageInputSchema = z.object({
  slug: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  body_md: z.string().min(10),
  published: z.boolean().optional()
});

export const updateCmsPageInputSchema = z.object({
  id: z.string(),
  slug: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  body_md: z.string().min(10).optional(),
  published: z.boolean().optional()
});

// =================================================================
// FILE UPLOADS SCHEMAS
// =================================================================

export const fileUploadSchema = z.object({
  id: z.string(),
  uploader_user_id: z.string(),
  purpose: UploadPurposeEnum,
  file_url: z.string().url(),
  mime_type: z.string(),
  file_size_bytes: z.number().int().positive(),
  created_at: z.coerce.date()
});

export const createFileUploadInputSchema = z.object({
  uploader_user_id: z.string(),
  purpose: UploadPurposeEnum,
  file_url: z.string().url(),
  mime_type: z.string(),
  file_size_bytes: z.number().int().positive()
});

// =================================================================
// WISHLISTS SCHEMAS
// =================================================================

export const wishlistSchema = z.object({
  id: z.string(),
  guest_user_id: z.string(),
  name: z.string(),
  created_at: z.coerce.date()
});

export const createWishlistInputSchema = z.object({
  guest_user_id: z.string(),
  name: z.string().min(1).max(255)
});

export const updateWishlistInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional()
});

// =================================================================
// WISHLIST ITEMS SCHEMAS
// =================================================================

export const wishlistItemSchema = z.object({
  wishlist_id: z.string(),
  villa_id: z.string(),
  added_at: z.coerce.date()
});

export const addWishlistItemInputSchema = z.object({
  wishlist_id: z.string(),
  villa_id: z.string()
});

// =================================================================
// SAVED SEARCHES SCHEMAS
// =================================================================

export const savedSearchSchema = z.object({
  id: z.string(),
  guest_user_id: z.string(),
  name: z.string(),
  criteria_json: z.any(),
  alert_enabled: z.boolean().default(true),
  created_at: z.coerce.date()
});

export const createSavedSearchInputSchema = z.object({
  guest_user_id: z.string(),
  name: z.string().min(1).max(255),
  criteria_json: z.any(),
  alert_enabled: z.boolean().optional()
});

export const updateSavedSearchInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  criteria_json: z.any().optional(),
  alert_enabled: z.boolean().optional()
});

// =================================================================
// GUIDEBOOKS SCHEMAS
// =================================================================

export const guidebookSchema = z.object({
  id: z.string(),
  villa_id: z.string(),
  title: z.string(),
  content_md: z.string(),
  pdf_url: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createGuidebookInputSchema = z.object({
  villa_id: z.string(),
  title: z.string().min(1).max(255),
  content_md: z.string().min(10),
  pdf_url: z.string().url().optional()
});

export const updateGuidebookInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255).optional(),
  content_md: z.string().min(10).optional(),
  pdf_url: z.string().url().optional()
});

// =================================================================
// INFERRED TYPES
// =================================================================

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;

export type UserSession = z.infer<typeof userSessionSchema>;
export type CreateUserSessionInput = z.infer<typeof createUserSessionInputSchema>;

export type Villa = z.infer<typeof villaSchema>;
export type CreateVillaInput = z.infer<typeof createVillaInputSchema>;
export type UpdateVillaInput = z.infer<typeof updateVillaInputSchema>;
export type SearchVillaInput = z.infer<typeof searchVillaInputSchema>;

export type RoomType = z.infer<typeof roomTypeSchema>;
export type CreateRoomTypeInput = z.infer<typeof createRoomTypeInputSchema>;

export type Amenity = z.infer<typeof amenitySchema>;
export type CreateAmenityInput = z.infer<typeof createAmenityInputSchema>;

export type Booking = z.infer<typeof bookingSchema>;
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;
export type SearchBookingInput = z.infer<typeof searchBookingInputSchema>;

export type BookingAddon = z.infer<typeof bookingAddonSchema>;
export type CreateBookingAddonInput = z.infer<typeof createBookingAddonInputSchema>;

export type Payment = z.infer<typeof paymentSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventInputSchema>;

export type PricingRule = z.infer<typeof pricingRuleSchema>;
export type CreatePricingRuleInput = z.infer<typeof createPricingRuleInputSchema>;

export type Inquiry = z.infer<typeof inquirySchema>;
export type CreateInquiryInput = z.infer<typeof createInquiryInputSchema>;

export type Message = z.infer<typeof messageSchema>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;

export type GuestReview = z.infer<typeof guestReviewSchema>;
export type CreateGuestReviewInput = z.infer<typeof createGuestReviewInputSchema>;

export type HostReview = z.infer<typeof hostReviewSchema>;
export type CreateHostReviewInput = z.infer<typeof createHostReviewInputSchema>;

export type LoyaltyCredit = z.infer<typeof loyaltyCreditSchema>;
export type CreateLoyaltyCreditInput = z.infer<typeof createLoyaltyCreditInputSchema>;

export type Host = z.infer<typeof hostSchema>;
export type CreateHostInput = z.infer<typeof createHostInputSchema>;

export type Payout = z.infer<typeof payoutSchema>;
export type CreatePayoutInput = z.infer<typeof createPayoutInputSchema>;

export type DamageReport = z.infer<typeof damageReportSchema>;
export type CreateDamageReportInput = z.infer<typeof createDamageReportInputSchema>;

export type ModerationQueue = z.infer<typeof moderationQueueSchema>;
export type CreateModerationQueueInput = z.infer<typeof createModerationQueueInputSchema>;

export type Ticket = z.infer<typeof ticketSchema>;
export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;

export type CmsPage = z.infer<typeof cmsPageSchema>;
export type CreateCmsPageInput = z.infer<typeof createCmsPageInputSchema>;

export type FileUpload = z.infer<typeof fileUploadSchema>;
export type CreateFileUploadInput = z.infer<typeof createFileUploadInputSchema>;

export type Wishlist = z.infer<typeof wishlistSchema>;
export type CreateWishlistInput = z.infer<typeof createWishlistInputSchema>;

export type WishlistItem = z.infer<typeof wishlistItemSchema>;
export type AddWishlistItemInput = z.infer<typeof addWishlistItemInputSchema>;

export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchInputSchema>;

export type Guidebook = z.infer<typeof guidebookSchema>;
export type CreateGuidebookInput = z.infer<typeof createGuidebookInputSchema>;