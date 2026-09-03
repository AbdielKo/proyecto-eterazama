import { useCallback, useEffect, useState } from "react";

type Tema = "dark" | "light";

const STORAGE_KEY = "eterazama-tema";

function temaInicial(): Tema {
  const guardado = localStorage.getItem(STORAGE_KEY);
  return guardado === "light" || guardado === "dark" ? guardado : "dark";
}

export function useTheme() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.remove("dark", "light");
    raiz.classList.add(tema);
    localStorage.setItem(STORAGE_KEY, tema);
  }, [tema]);

  const toggleTema = useCallback(() => {
    setTema((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { tema, toggleTema };
}