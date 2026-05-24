import { createSignal, onCleanup, onMount } from "solid-js";
import { useDragDropContext } from "@thisbeyond/solid-dnd";
import type { Id } from "@thisbeyond/solid-dnd";
import { lockGestureScroll, unlockGestureScroll } from "./scrollLock.ts";

const SENSOR_ID = "touch-row-sensor";

interface GrabOffset {
  x: number;
  y: number;
}

function useTouchSortableDrag() {
  const context = useDragDropContext();
  if (!context) {
    throw new Error("useTouchSortableDrag must be used within DragDropProvider");
  }
  const [state, actions] = context;
  const [grabOffset, setGrabOffset] = createSignal<GrabOffset>({ x: 0, y: 0 });

  onMount(() => {
    actions.addSensor({ id: SENSOR_ID, activators: {} });
  });

  onCleanup(() => {
    unlockGestureScroll();
    actions.removeSensor(SENSOR_ID);
  });

  function startDrag(draggableId: Id, clientX: number, clientY: number, surfaceEl: HTMLElement) {
    const rect = surfaceEl.getBoundingClientRect();
    setGrabOffset({ x: clientX - rect.left, y: clientY - rect.top });
    lockGestureScroll();
    actions.sensorStart(SENSOR_ID, { x: clientX, y: clientY });
    actions.dragStart(draggableId);
  }

  function moveDrag(clientX: number, clientY: number) {
    if (state.active.sensorId !== SENSOR_ID) return;
    actions.sensorMove({ x: clientX, y: clientY });
  }

  function endDragIfActive() {
    if (state.active.sensorId === SENSOR_ID) {
      actions.dragEnd();
      actions.sensorEnd();
      unlockGestureScroll();
    }
  }

  const isDragging = () => state.active.sensorId === SENSOR_ID;

  return { startDrag, moveDrag, endDragIfActive, isDragging, grabOffset };
}

export { useTouchSortableDrag, SENSOR_ID };
export type { GrabOffset };
