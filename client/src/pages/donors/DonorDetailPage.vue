<script setup lang="ts">
// HU-20 — Historial de donaciones por donante.
// Encabezado con los datos del donante + totales agregados (nº de donaciones,
// peso total en especie, monto monetario total) y la tabla de donaciones ya
// ordenada por fecha descendente por el backend (GET /donors/:id/donations).
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, SearchX } from '@lucide/vue'
import { useDonor, useDonorDonations } from '@/composables/useDonors'
import { DONOR_TYPE_LABELS } from '@/types/donor.types'
import {
  DONATION_TYPE_LABELS,
  DONATION_TYPE_BADGE,
} from '@/types/donation.types'
import type { Donation } from '@/types/donation.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))

const { data: donor, isLoading, isError } = useDonor(id)
const { data: donations, isLoading: loadingDonations } = useDonorDonations(id)

const rows = computed<Donation[]>(() => donations.value ?? [])

// --- Totales agregados (HU-20) -----------------------------------------------
// El peso por renglón ya viene calculado en cada detail (weight_kg). El monto
// monetario llega como string (pg NUMERIC) o null; se suma de forma segura.
const totalCount = computed(() => rows.value.length)

const totalWeight = computed(() =>
  rows.value.reduce(
    (acc, d) =>
      acc + (d.details ?? []).reduce((s, it) => s + Number(it.weight_kg || 0), 0),
    0,
  ),
)

const totalAmount = computed(() =>
  rows.value.reduce((acc, d) => acc + Number(d.monetary_amount ?? 0), 0),
)

// --- Formateadores ------------------------------------------------------------
const fmtKg = (n: number) =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`

const fmtCurrency = (n: number) =>
  n.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })

// Peso total (en especie) de una donación concreta para la columna de la tabla.
const donationWeight = (d: Donation) =>
  (d.details ?? []).reduce((s, it) => s + Number(it.weight_kg || 0), 0)

const columns = [
  { key: 'donation_code', label: 'Código', mono: true },
  { key: 'date', label: 'Fecha' },
  { key: 'donation_type', label: 'Tipo' },
  { key: 'weight', label: 'Peso', align: 'right' as const },
  { key: 'amount', label: 'Monto', align: 'right' as const },
  { key: 'items', label: 'Renglones', align: 'center' as const },
]

const asDonation = (r: unknown) => r as Donation
</script>

<template>
  <section class="space-y-5">
    <!-- Carga / error -->
    <div v-if="isLoading" class="space-y-4">
      <SkeletonBlock height="40px" width="280px" />
      <SkeletonBlock height="160px" rounded="12px" />
    </div>
    <div
      v-else-if="isError || !donor"
      class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center"
    >
      <p class="text-sm text-danger">No se pudo cargar el donante.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="router.push('/donors')">
        <ArrowLeft /> Volver a donantes
      </AppButton>
    </div>

    <template v-else>
      <PageHeader :title="donor.name" crumb="Donaciones">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/donors')">
            <ArrowLeft /> Volver
          </AppButton>
        </template>
      </PageHeader>

      <!-- Datos del donante -->
      <div class="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold text-neutral-900">Datos del donante</h2>
          <span
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
              donor.is_active
                ? 'text-success bg-success-bg border-success-br'
                : 'text-neutral-500 bg-neutral-100 border-neutral-200',
            ]"
          >
            <span class="h-[7px] w-[7px] rounded-full bg-current" />
            {{ donor.is_active ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
        <dl class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt class="text-sm text-neutral-500">Tipo</dt>
            <dd class="mt-1">
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-neutral-700"
              >
                {{ DONOR_TYPE_LABELS[donor.type] }}
              </span>
            </dd>
          </div>
          <div>
            <dt class="text-sm text-neutral-500">Contacto</dt>
            <dd class="text-neutral-900">{{ donor.contact }}</dd>
          </div>
          <div>
            <dt class="text-sm text-neutral-500">Identificación tributaria</dt>
            <dd class="font-mono text-sm text-neutral-900">{{ donor.tax_id || '—' }}</dd>
          </div>
        </dl>
      </div>

      <!-- Totales agregados -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Donaciones" :value="totalCount" />
        <KpiCard label="Peso total (en especie)" :value="fmtKg(totalWeight)" tone="primary" />
        <KpiCard label="Monto total" :value="fmtCurrency(totalAmount)" tone="accent" />
      </div>

      <!-- Historial de donaciones -->
      <div class="space-y-3">
        <h2 class="text-base font-semibold text-neutral-900">
          Historial de donaciones
          <span class="text-neutral-400">({{ totalCount }})</span>
        </h2>

        <div v-if="loadingDonations" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
          <SkeletonBlock v-for="n in 5" :key="n" height="44px" />
        </div>

        <DataTable v-else :columns="columns" :rows="rows" row-key="id" min-width="720px">
          <template #donation_code="{ value }">
            <span class="font-semibold text-neutral-900">{{ value }}</span>
          </template>

          <template #date="{ row }">
            {{ fmtDate(asDonation(row).date) }}
          </template>

          <template #donation_type="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                DONATION_TYPE_BADGE[asDonation(row).donation_type],
              ]"
            >
              {{ DONATION_TYPE_LABELS[asDonation(row).donation_type] }}
            </span>
          </template>

          <template #weight="{ row }">
            <span v-if="donationWeight(asDonation(row)) > 0">
              {{ fmtKg(donationWeight(asDonation(row))) }}
            </span>
            <span v-else class="text-neutral-400">—</span>
          </template>

          <template #amount="{ row }">
            <span v-if="asDonation(row).monetary_amount != null">
              {{ fmtCurrency(Number(asDonation(row).monetary_amount)) }}
            </span>
            <span v-else class="text-neutral-400">—</span>
          </template>

          <template #items="{ row }">
            {{ asDonation(row).details?.length ?? 0 }}
          </template>

          <template #empty>
            <EmptyState
              title="Sin donaciones"
              message="Este donante aún no tiene donaciones registradas."
            >
              <template #icon><SearchX /></template>
            </EmptyState>
          </template>
        </DataTable>
      </div>
    </template>
  </section>
</template>
