function applyReorder(
  orderedIds: string[],
  draggableId: string,
  droppableId: string,
): string[] | null {
  if (draggableId === droppableId) return null;

  const fromIndex = orderedIds.indexOf(draggableId);
  const toIndex = orderedIds.indexOf(droppableId);
  if (fromIndex === -1 || toIndex === -1) return null;

  const reordered = [...orderedIds];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

export { applyReorder };
