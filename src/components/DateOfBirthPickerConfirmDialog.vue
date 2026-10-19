<script setup>
import { computed, ref, watch } from 'vue'
import { utc_date_key, initial_date_indices, normalize_date_indices, date_picker_columns, date_from_indices } from '@/utils/dateOfBirthPicker.js'
import EventConfirmDialog from './EventConfirmDialog.vue'
const props = defineProps({ open: Boolean, busy: Boolean, value: { type: String, default: '' }, now: { type: Number, required: true } })
const emit = defineEmits(['confirm', 'close'])
const day_key = computed(() => utc_date_key(props.now)), calendar_clock = computed(() => Date.parse(day_key.value + 'T00:00:00Z'))
const selected = ref(initial_date_indices(props.value, props.now))
const columns = computed(() => date_picker_columns(selected.value, calendar_clock.value))
const labels = ['Year', 'Month', 'Day']
watch(() => props.open, open => { if (open) selected.value = initial_date_indices(props.value, props.now) })
const change = event => { if (!props.busy) selected.value = normalize_date_indices(event.detail.value, calendar_clock.value) }
const key_select = (event, column) => {
  if (props.busy) return
  const delta = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[event.key]
  if (delta === undefined && !['Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next = [...selected.value]
  next[column] = event.key === 'Home' ? 0 : event.key === 'End' ? columns.value[column].length - 1 : next[column] + delta
  selected.value = normalize_date_indices(next, calendar_clock.value)
}
const confirm = () => { if (props.open && !props.busy) emit('confirm', date_from_indices(selected.value, calendar_clock.value)) }
</script>
<template>
  <EventConfirmDialog class="dob-picker" :open="open" :busy="busy" label="Date of birth" close-interaction="age.datePicker.mask.click.1" @close="emit('close')">
    <text class="event-dialog-title">Date of birth</text>
    <view class="dob-labels"><text v-for="label in labels" :key="label">{{ label }}</text></view>
    <picker-view v-if="open" class="dob-wheels" :value="selected" indicator-class="dob-wheel-indicator" mask-style="background-image: none;" data-interaction="age.onObDob.change.1" @change="change">
      <picker-view-column v-for="(values, column) in columns" :key="column" role="spinbutton" tabindex="0" :aria-label="labels[column]" :aria-valuemin="values[0]" :aria-valuemax="values.at(-1)" :aria-valuenow="values[selected[column]]" @keydown="key_select($event, column)">
        <view v-for="value in values" :key="value" class="dob-option">{{ String(value).padStart(column === 0 ? 4 : 2, '0') }}</view>
      </picker-view-column>
    </picker-view>
    <view class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="age.datePicker.confirm.click.1" @click="confirm" @keydown.enter="confirm">Done</view>
    <view class="event-dialog-secondary" role="button" tabindex="0" :aria-disabled="busy" data-interaction="age.datePicker.cancel.click.1" @click="!busy && emit('close')" @keydown.enter="!busy && emit('close')">Cancel</view>
  </EventConfirmDialog>
</template>
<style scoped>
.dob-picker { --event-dialog-bottom: var(--app-safe-bottom); }
.dob-labels { display: flex; margin-top: 30.534rpx; color: var(--cimoa-text-secondary); font-size: 27.672rpx; text-align: center; }
.dob-labels > text { flex: 1; }
.dob-wheels { height: 381.679rpx; margin-top: 11.45rpx; color: var(--cimoa-text-title); }
.dob-option { height: 76.336rpx; line-height: 76.336rpx; text-align: center; font-size: 34.351rpx; }
.dob-wheels :deep(.uni-picker-view-indicator) { height: 76.336rpx; border-color: var(--cimoa-surface-border); }
.dob-wheels :deep(.uni-picker-view-indicator)::before,
.dob-wheels :deep(.uni-picker-view-indicator)::after { border-color: var(--cimoa-surface-border); }
</style>
