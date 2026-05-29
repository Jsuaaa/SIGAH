<script setup lang="ts" generic="T extends object">
// Tabla presentacional genérica alineada al sistema de diseño. Personaliza cada
// celda con un slot del nombre de su `key` (el slot recibe { row, value }):
//   <DataTable :columns="cols" :rows="rows">
//     <template #estado="{ row }"><StatusBadge :status="row.estado" /></template>
//   </DataTable>
// Slots adicionales: #toolbar, #footer, #empty.
interface Column {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  mono?: boolean
}
withDefaults(
  defineProps<{
    columns: Column[]
    rows: T[]
    rowKey?: string
    minWidth?: string
  }>(),
  { rowKey: 'id', minWidth: '640px' },
)

function cell(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}
function alignCls(a?: string) {
  return a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-neutral-200 bg-white">
    <div v-if="$slots.toolbar" class="border-b border-neutral-200 p-3">
      <slot name="toolbar" />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm" :style="{ minWidth }">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="[
                'border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase whitespace-nowrap',
                alignCls(col.align),
              ]"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="String(cell(row, rowKey) ?? i)" class="hover:bg-primary-50">
            <td
              v-for="col in columns"
              :key="col.key"
              :class="[
                'border-b border-neutral-100 px-4 py-3 align-middle text-neutral-700',
                alignCls(col.align),
                col.mono ? 'font-mono text-xs' : '',
              ]"
            >
              <slot :name="col.key" :row="row" :value="cell(row, col.key)">{{ cell(row, col.key) }}</slot>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="columns.length" class="px-4 py-10">
              <slot name="empty">
                <p class="text-center text-sm text-neutral-500">Sin registros.</p>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="$slots.footer"
      class="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-600"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
