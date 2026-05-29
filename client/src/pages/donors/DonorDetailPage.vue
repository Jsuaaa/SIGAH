<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus, Gift, RotateCcw } from '@lucide/vue'
import { useDonor, useDonorDonations } from '@/composables/useDonors'
import { DONOR_TYPE_LABELS } from '@/types/donor.types'
import { DONATION_TYPE_LABELS } from '@/types/donation.types'
import type { DonationEnriched } from '@/types/donation.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const route = useRoute()
const router = useRouter()
const donorId = computed(() => Number(route.params.id))
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'] as const

const { data: donor, isLoading, isError, refetch } = useDonor(donorId)
const { data: donations, isLoading: loadingDonations } = useDonorDonations(donorId)

const asDonation = (r: unknown) => r as DonationEnriched

const columns = [
  { key: 'donation_code', label: 'Código', mono: true },
  { key: 'donation_type', label: 'Tipo' },
  { key: 'date', label: 'Fecha' },
  { key: 'amount', label: 'Monto', align: 'right' as const },
  { key: 'weight', label: 'Peso', align: 'right' as const },
  { key: 'items', label: 'Ítems', align: 'center' as const },
]

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMoney(v: string | null) {
  if (!v) return '—'
  return Number(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}
function donationWeight(d: DonationEnriched) {
  if (!d.details?.length) return '—'
  const w = d.details.reduce((a, it) => a + (it.weight_kg ?? 0), 0)
  return `${Math.round(w).toLocaleString('es-CO')} kg`
}

const totalMoney = computed(() =>
  (donations.value ?? []).reduce((a, d) => a + Number(d.monetary_amount ?? 0), 0),
)
</script>

<template>
  <section class="space-y-5">
    <div v-if="isLoading" class="space-y-4">
      <SkeletonBlock height="120px" />
      <SkeletonBlock height="180px" />
    </div>
    <div v-else-if="isError || !donor" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar el donante.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <template v-else>
      <PageHeader :title="donor.name" :crumb="`Donantes · ${DONOR_TYPE_LABELS[donor.type]}`">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/donors')"><ArrowLeft /> Volver</AppButton>
          <RoleGate :roles="[...EDIT_ROLES]">
            <AppButton @click="router.push(`/donations/new?donor_id=${donorId}`)"><Plus /> Nueva donación</AppButton>
          </RoleGate>
        </template>
      </PageHeader>

      <div class="rounded-lg border border-neutral-200 bg-white p-5">
        <dl class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-neutral-500">Tipo</dt>
            <dd class="font-medium text-neutral-900">{{ DONOR_TYPE_LABELS[donor.type] }}</dd>
          </div>
          <div>
            <dt class="text-neutral-500">Contacto</dt>
            <dd class="font-medium text-neutral-900">{{ donor.contact }}</dd>
          </div>
          <div>
            <dt class="text-neutral-500">NIT / Documento</dt>
            <dd class="font-medium text-neutral-900">{{ donor.tax_id || '—' }}</dd>
          </div>
          <div>
            <dt class="text-neutral-500">Estado</dt>
            <dd class="font-medium" :class="donor.is_active ? 'text-success' : 'text-neutral-500'">
              {{ donor.is_active ? 'Activo' : 'Inactivo' }}
            </dd>
          </div>
          <div>
            <dt class="text-neutral-500">Donaciones</dt>
            <dd class="font-medium text-neutral-900">{{ donations?.length ?? 0 }}</dd>
          </div>
          <div>
            <dt class="text-neutral-500">Total monetario</dt>
            <dd class="font-medium text-neutral-900">
              {{ totalMoney.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) }}
            </dd>
          </div>
        </dl>
      </div>

      <h2 class="text-sm font-semibold text-neutral-700">Historial de donaciones</h2>
      <div v-if="loadingDonations" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
        <SkeletonBlock v-for="n in 3" :key="n" height="40px" />
      </div>
      <DataTable v-else :columns="columns" :rows="donations ?? []" row-key="id" min-width="720px">
        <template #donation_type="{ row }">{{ DONATION_TYPE_LABELS[asDonation(row).donation_type] }}</template>
        <template #date="{ row }">{{ fmtDate(asDonation(row).date) }}</template>
        <template #amount="{ row }"><span class="font-mono text-xs">{{ fmtMoney(asDonation(row).monetary_amount) }}</span></template>
        <template #weight="{ row }"><span class="font-mono text-xs">{{ donationWeight(asDonation(row)) }}</span></template>
        <template #items="{ row }">{{ asDonation(row).details?.length ?? 0 }}</template>
        <template #empty>
          <EmptyState title="Sin donaciones" message="Este donante aún no tiene donaciones registradas.">
            <template #icon><Gift /></template>
            <template #action>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton size="sm" @click="router.push(`/donations/new?donor_id=${donorId}`)"><Plus /> Nueva donación</AppButton>
              </RoleGate>
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </template>
  </section>
</template>
