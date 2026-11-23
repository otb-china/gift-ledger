<template>
  <div
    class="swipe-row"
    @pointerdown="start"
    @pointermove="move"
    @pointerup="finish"
    @pointercancel="cancel"
    @pointerleave="!dragging && cancel($event)"
    @lostpointercapture.self="cancel"
    @click.capture="guardClick"
  >
    <div v-if="distance" class="swipe-hint" aria-hidden="true">
      {{ reversed ? "已取消" : armed ? "松手确认删除" : "左滑删除" }}
    </div>
    <div class="swipe-content" :class="{ dragging }" :style="{ transform: `translateX(-${distance}px)` }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const emit = defineEmits<{ remove: [] }>();
const distance = ref(0);
const width = ref(0);
const dragging = ref(false);
const reversed = ref(false);
const armed = computed(() => distance.value > width.value / 2 && !reversed.value);
let pointer: number | null = null;
let startX = 0;
let startY = 0;
let furthest = 0;
let suppressClick = false;
const slop = 8;

function start(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || pointer !== null) return;
  pointer = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  width.value = (event.currentTarget as HTMLElement).getBoundingClientRect().width;
  furthest = 0;
  suppressClick = false;
}

function move(event: PointerEvent) {
  if (pointer !== event.pointerId) return;
  const dx = startX - event.clientX;
  const dy = Math.abs(event.clientY - startY);
  if (!dragging.value) {
    if (Math.max(Math.abs(dx), dy) < slop) return;
    suppressClick = true;
    if (dx <= dy) {
      pointer = null;
      return;
    }
    dragging.value = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  furthest = Math.max(furthest, dx);
  if (furthest - dx >= slop) reversed.value = true;
  distance.value = Math.max(0, Math.min(dx, width.value));
}

function finish(event: PointerEvent) {
  if (pointer !== event.pointerId) return;
  if (dragging.value) move(event);
  const remove = dragging.value && armed.value;
  cancel(event);
  if (remove) emit("remove");
}

function cancel(event: PointerEvent) {
  if (pointer !== event.pointerId) return;
  pointer = null;
  dragging.value = false;
  reversed.value = false;
  distance.value = 0;
}

function guardClick(event: MouseEvent) {
  if (suppressClick && event.detail > 0) {
    event.preventDefault();
    event.stopPropagation();
  }
}
</script>

<style scoped>
.swipe-row {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border-radius: 18px;
  touch-action: pan-y pinch-zoom;
  user-select: none;
}
.swipe-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 18px;
  background: var(--danger-bg);
  color: var(--danger-text);
  font-size: 13px;
  font-weight: 700;
}
.swipe-content { position: relative; transition: transform 160ms ease-out; }
.dragging { transition: none; }
</style>
