import type {
  ConfiguracionAsientos,
  CeldaAsiento,
} from "../utils/asientos-config";
import { resolverMatriz } from "../utils/asientos-config";
import { Circle, CheckCircle } from "lucide-react";

interface Props {
  config: ConfiguracionAsientos;
  asientosChofer?: number[];
  asientosOcupados?: number[];
  seleccionados?: number[];
  onSeleccionar?: (numero: number, celda: CeldaAsiento) => void;
  onClickOcupado?: (numero: number, celda: CeldaAsiento) => void;
  soloOcupados?: boolean;
  mostrarFrente?: boolean;
}

function interior(celda: CeldaAsiento, seleccionado: boolean) {
  if (celda.estado === "espacio") return null;
  let icono: React.ReactNode = null;
  if (seleccionado) icono = <CheckCircle className="w-3 h-3" />;
  else if (celda.estado === "ocupado")
    icono = <Circle className="w-3 h-3 opacity-70" />;
  return (
    <>
      {icono}
      <span className="leading-none">{celda.numero}</span>
      {celda.esChofer && (
        <span className="text-[7px] leading-none">CHOFER</span>
      )}
    </>
  );
}

export default function DistribucionAsientos({
  config,
  asientosChofer = [],
  asientosOcupados = [],
  seleccionados = [],
  onSeleccionar,
  onClickOcupado,
  soloOcupados = false,
  mostrarFrente = true,
}: Props) {
  const matriz = resolverMatriz(config, asientosChofer, asientosOcupados);
  const ancho = matriz.length > 0 ? matriz[0].length : 0;

  function clase(celda: CeldaAsiento, seleccionado: boolean) {
    let clase = "bg-gray-800 text-gray-300 border border-gray-700";
    if (celda.estado === "espacio")
      clase = "bg-transparent border border-dashed border-gray-700/60 cursor-default";
    else if (celda.estado === "chofer")
      clase = "bg-amber-600/20 text-amber-400 border border-amber-600/40";
    else if (celda.estado === "ocupado")
      clase = seleccionado
        ? "bg-sky-600 text-white ring-2 ring-sky-400 border-sky-500"
        : "bg-red-600/20 text-red-400 border border-red-600/30";
    else if (soloOcupados)
      clase = "bg-gray-700/30 text-gray-500 border border-gray-700 cursor-not-allowed";
    else if (seleccionado)
      clase = "bg-sky-600 text-white ring-2 ring-sky-400";
    return clase;
  }

  return (
    <div className="flex flex-col items-center gap-1.5 max-w-xs mx-auto w-full">
      {mostrarFrente && (
        <div className="bg-gray-700 rounded-t-xl w-full py-1.5 text-center text-[10px] text-gray-400 font-medium tracking-widest">
          FRENTE
        </div>
      )}
      <div className="flex flex-col items-center gap-1.5">
        {matriz.map((fila, fi) => (
          <div
            key={fi}
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${ancho || 1}, 3rem)`,
              gap: "0.375rem",
            }}
          >
            {fila.map((celda) => {
              const seleccionado =
                celda.numero !== null && seleccionados.includes(celda.numero);
              const clickeable =
                !soloOcupados &&
                celda.estado !== "espacio" &&
                celda.estado !== "chofer" &&
                celda.estado !== "ocupado";
              const ocupadoClickeable =
                celda.estado === "ocupado" && !!onClickOcupado && celda.numero !== null;

              return (
                <div
                  key={`${celda.fila}-${celda.columna}`}
                  title={
                    celda.estado === "espacio"
                      ? "Espacio vacío"
                      : celda.estado === "chofer"
                      ? `Asiento ${celda.numero} · Chofer`
                      : celda.estado === "ocupado"
                      ? `Asiento ${celda.numero} · Ocupado - toca para ver pasajero`
                      : `Asiento ${celda.numero} · Disponible`
                  }
                  onClick={() => {
                    if (celda.numero === null) return;
                    if (clickeable && onSeleccionar) onSeleccionar(celda.numero, celda);
                    else if (ocupadoClickeable && onClickOcupado) onClickOcupado(celda.numero, celda);
                  }}
                  className={`w-12 h-12 rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5 ${clase(celda, seleccionado)} ${
                    clickeable
                      ? "cursor-pointer hover:bg-gray-700 hover:text-white"
                      : ocupadoClickeable
                      ? "cursor-pointer hover:ring-2 hover:ring-red-400/40"
                      : ""
                  }`}
                >
                  {interior(celda, seleccionado)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
