"use client";

import { useEffect } from "react";

/** A visible cursor for embedded browsers that ignore CSS image cursors. */
export function CustomCursor() {
  useEffect(() => {
    const cursor = document.createElement("img");
    cursor.src = "/cockatiel-cursor-moderate.png";
    cursor.alt = "";
    cursor.setAttribute("aria-hidden", "true");
    cursor.className = "site-cursor";
    document.body.appendChild(cursor);

    const hide = () => {
      cursor.style.visibility = "hidden";
      document.body.classList.remove("has-site-cursor");
    };
    const move = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) {
        hide();
        return;
      }
      // A modal <dialog> draws above every z-index, so the cursor has to live inside it to stay visible.
      const host = (target instanceof Element && target.closest("dialog[open]")) || document.body;
      if (cursor.parentElement !== host) host.appendChild(cursor);
      cursor.style.transform = `translate3d(${event.clientX - 30}px, ${event.clientY - 3}px, 0)`;
      cursor.style.visibility = "visible";
      document.body.classList.add("has-site-cursor");
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) hide(); };

    document.addEventListener("mousemove", move, { passive: true });
    document.addEventListener("pointerout", leave);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", hide);
      document.body.classList.remove("has-site-cursor");
      cursor.remove();
    };
  }, []);

  return null;
}
