/**
 * Vibración corta al cambiar cantidades. Ocho milisegundos, no 50: con
 * 50 el teléfono zumba y el usuario piensa que le llegó una
 * notificación. No hace nada donde no hay soporte: iOS Safari no
 * expone `navigator.vibrate` y eso no es un bug.
 */
export function tapFeedback(): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  navigator.vibrate(8);
}
