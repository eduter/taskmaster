import { createContext, useContext, type ParentComponent } from "solid-js";
import { useTouchSortableDrag } from "./useTouchSortableDrag.ts";

type TouchDragApi = ReturnType<typeof useTouchSortableDrag>;

const TouchDragContext = createContext<TouchDragApi>();

const TouchDragProvider: ParentComponent = (props) => {
  const api = useTouchSortableDrag();
  return (
    <TouchDragContext.Provider value={api}>{props.children}</TouchDragContext.Provider>
  );
};

function useTouchDrag(): TouchDragApi {
  const api = useContext(TouchDragContext);
  if (!api) {
    throw new Error("useTouchDrag must be used within TouchDragProvider");
  }
  return api;
}

export { TouchDragProvider, useTouchDrag };
