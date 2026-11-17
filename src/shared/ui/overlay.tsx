import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PageActiveContext } from "./page-active";

export function Overlay({ children }: { children: ReactNode }) {
  const active = useContext(PageActiveContext);
  return active ? createPortal(children, document.body) : null;
}
