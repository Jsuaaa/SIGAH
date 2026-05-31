import { z } from 'zod'
import { DONATION_TYPE_OPTIONS, type DonationType } from '@/types/donation.types'

const DONATION_TYPE_VALUES = DONATION_TYPE_OPTIONS.map((o) => o.value) as [
  DonationType,
  ...DonationType[],
]

const itemSchema = z.object({
  resource_type_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
})

export const donationSchema = z.object({
  donor_id: z.coerce.number().int().positive(),
  donation_type: z.enum(DONATION_TYPE_VALUES),
  destination_warehouse_id: z.coerce.number().int().positive().nullable().optional(),
  monetary_amount: z.coerce.number().positive().nullable().optional(),
  date: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(itemSchema).default([]),
})

export type DonationFormValues = z.infer<typeof donationSchema>
