// context/stickerSoundsStore.js
//
// El contexto y el hook viven aparte del componente Provider para que el
// fast-refresh de React siga funcionando (un archivo de componente no debe
// exportar también funciones/constantes).
import { createContext, useContext } from "react";

export const StickerSoundsContext = createContext(null);

export function useStickerSounds() {
  const ctx = useContext(StickerSoundsContext);
  if (!ctx) {
    throw new Error(
      "useStickerSounds debe usarse dentro de <StickerSoundsProvider>"
    );
  }
  return ctx;
}
