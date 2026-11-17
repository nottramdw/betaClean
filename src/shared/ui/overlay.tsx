import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
