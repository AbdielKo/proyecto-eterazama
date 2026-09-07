import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { obtenerVehiculos } from "../../api/flota.api";
import { registrarVenta, obtenerPrecios } from "../../api/pasajes.api";
import type { Vehiculo } from "../../types/vehiculo";
import DistribucionAsientos from "../../components/DistribucionAsientos";
import { Car, CheckCircle, AlertCircle, QrCode, ArrowLeft, ArrowRight, User, Share2 } from "lucide-react";

type Paso = 1 | 2 | 3 | 4 | 5;

export default function ComprarPasaje() {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const stateVehiculo = (location.state as { vehiculo?: Vehiculo; tramo?: string }) || {};

  const [paso, setPaso] = useState<Paso>(stateVehiculo.vehiculo ? 3 : 1);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [tramo, setTramo] = useState(stateVehiculo.tramo || "cochabamba");
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(stateVehiculo.vehiculo || null);
  const [asientosSeleccionados, setAsientosSeleccionados] = useState<number[]>([]);
  const [exito, setExito] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const [datos, setDatos] = useState({
    nombre: usuario?.nombre || "",
    ci: "",
    telefono: "",
  });

  // Precios oficiales del sindicato (el backend cobra SIEMPRE este precio).
  const [precios, setPrecios] = useState({
    cochabamba: 20,
    eterazama: 15,
  });

  const [pasajeros, setPasajeros] = useState<Record<number, string>>({});

  useEffect(() => {
    obtenerVehiculos().then(setVehiculos).catch(console.error);
    obtenerPrecios().then(setPrecios).catch(console.error);
  }, []);

  const disponibles = vehiculos.filter((v) => v.paradaActual === tramo);

  const capacidadAsientos = Math.max(4, vehiculoSeleccionado?.capacidadTotal || 12);
  const asientosChofer = vehiculoSeleccionado?.asientosChofer || [];
  const configAsientos = (() => {
    const cfg = vehiculoSeleccionado?.configuracionAsientos;
    if (cfg && Array.isArray(cfg.filas) && cfg.filas.length > 0) return cfg;
    const filas: (number | null)[][] = [];
    for (let i = 1; i <= capacidadAsientos; i += 3) {
      filas.push([i, i + 1, i + 2].filter((n) => n <= capacidadAsientos));
    }
    return { ancho: 3, filas };
  })();
  const ocupados = vehiculoSeleccionado?.asientosOcupados || [];
  const precioUnitario = (precios as Record<string, number>)[tramo] || 0;
  const precioTotal = asientosSeleccionados.length * precioUnitario;

  function toggleAsiento(num: number) {
    if (ocupados.includes(num) || asientosChofer.includes(num)) return;
    setAsientosSeleccionados((prev) => {
      const nuevos = prev.includes(num) ? prev.filter((a) => a !== num) : [...prev, num];
      const nuevosPasajeros: Record<number, string> = {};
      nuevos.forEach((a) => { nuevosPasajeros[a] = pasajeros[a] || ""; });
      setPasajeros(nuevosPasajeros);
      return nuevos;
    });
  }

  function actualizarNombrePasajero(asiento: number, nombre: string) {
    setPasajeros((prev) => ({ ...prev, [asiento]: nombre }));
  }

  function todosLosNombresCompletos(): boolean {
    if (asientosSeleccionados.length === 0) return false;
    if (!datos.nombre) return false;
    return asientosSeleccionados.every((a) => pasajeros[a]?.trim());
  }

  function textoRecibo(): string {
    let texto = `*Recibo Trans Eterazama*\n\n`;
    texto += `Comprador: ${datos.nombre}\n`;
    texto += `Ruta: ${tramo === "cochabamba" ? "Cochabamba - Eterazama" : "Eterazama - Cochabamba"}\n`;
    texto += `Vehiculo: ${vehiculoSeleccionado?.placa}\n`;
    texto += `Chofer: ${vehiculoSeleccionado?.choferNombre}\n`;
    texto += `Asientos: ${asientosSeleccionados.join(", ")}\n\n`;
    asientosSeleccionados.forEach((a) => {
      texto += `Asiento ${a}: ${pasajeros[a] || datos.nombre}\n`;
    });
    texto += `\nTotal: Bs ${precioTotal}`;
    return texto;
  }

  function compartirWhatsApp() {
    const texto = encodeURIComponent(textoRecibo());
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  }

  function compartirGmail() {
    const asunto = encodeURIComponent("Recibo Trans Eterazama");
    const cuerpo = encodeURIComponent(textoRecibo());
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${asunto}&body=${cuerpo}`, "_blank");
  }

  async function confirmarCompra() {
    if (!vehiculoSeleccionado || asientosSeleccionados.length === 0) return;
    setError("");
    try {
      setCargando(true);
      await registrarVenta({
        pasajeroNombre: datos.nombre,
        placaVehiculo: vehiculoSeleccionado.placa,
        asientos: asientosSeleccionados,
        montoAsientos: asientosSeleccionados.length * precioUnitario,
        montoEncomienda: 0,
        montoTotal: precioTotal,
        tramo,
        contactoRecibo: `${datos.ci} ${datos.telefono}`.trim(),
      });
      setExito("Pasaje comprado exitosamente!");
      setPaso(5);
    } catch {
      setError("Error al procesar el pago");
    } finally {
      setCargando(false);
    }
  }

  if (exito && paso === 5) {
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Boleto Confirmado!</h2>
          <p className="text-gray-400">Tu pasaje ha sido registrado correctamente</p>

          <div className="bg-gray-800 rounded-xl p-5 text-left space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-400">Comprador</span><span className="text-white font-medium">{datos.nombre}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Vehiculo</span><span className="text-sky-400 font-mono">{vehiculoSeleccionado?.placa}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Chofer</span><span className="text-white">{vehiculoSeleccionado?.choferNombre}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Tramo</span><span className="text-white">{tramo === "cochabamba" ? "Cochabamba - Eterazama" : "Eterazama - Cochabamba"}</span></div>
            <hr className="border-gray-700" />
            <div>
              <p className="text-xs text-gray-400 mb-1">Pasajeros:</p>
              {asientosSeleccionados.map((a) => (
                <div key={a} className="flex justify-between text-sm">
                  <span className="text-gray-400">Asiento {a}</span>
                  <span className="text-white">{pasajeros[a] || datos.nombre}</span>
                </div>
              ))}
            </div>
            <hr className="border-gray-700" />
            <div className="flex justify-between text-sm"><span className="text-gray-400 font-semibold">Total pagado</span><span className="text-green-400 font-bold text-lg">Bs {precioTotal}</span></div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 flex flex-col items-center">
            <QrCode className="w-32 h-32 text-white" />
            <p className="text-xs text-gray-500 mt-2">Codigo QR de tu pasaje</p>
          </div>

          <div className="flex gap-2">
            <button onClick={compartirWhatsApp} className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">
              <Share2 className="w-4 h-4" /> WhatsApp
            </button>
            <button onClick={compartirGmail} className="flex-1 flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">
              <Share2 className="w-4 h-4" /> Gmail
            </button>
          </div>

          <button onClick={() => { setExito(""); setPaso(1); setVehiculoSeleccionado(null); setAsientosSeleccionados([]); setPasajeros({}); setDatos({ nombre: usuario?.nombre || "", ci: "", telefono: "" }); }} className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors cursor-pointer">
            Comprar otro pasaje
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Comprar Pasaje</h1>
        <p className="text-gray-400 text-sm mt-0.5">Paso {paso} de 4</p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {[1, 2, 3, 4].map((p) => (
          <div key={p} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${paso >= p ? "bg-sky-600 text-white" : "bg-gray-800 text-gray-500"}`}>{p}</div>
            {p < 4 && <div className={`w-8 h-0.5 ${paso > p ? "bg-sky-600" : "bg-gray-800"}`} />}
          </div>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

      {paso === 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">Seleccionar ruta</h2>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setTramo("cochabamba")} className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${tramo === "cochabamba" ? "border-sky-500 bg-sky-500/10" : "border-gray-700 bg-gray-800 hover:border-gray-600"}`}>
              <p className="text-lg font-bold text-white">Cochabamba</p>
              <ArrowRight className="w-4 h-4 text-gray-400 my-1" />
              <p className="text-lg font-bold text-sky-400">Eterazama</p>
            </button>
            <button onClick={() => setTramo("eterazama")} className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${tramo === "eterazama" ? "border-sky-500 bg-sky-500/10" : "border-gray-700 bg-gray-800 hover:border-gray-600"}`}>
              <p className="text-lg font-bold text-sky-400">Eterazama</p>
              <ArrowRight className="w-4 h-4 text-gray-400 my-1" />
              <p className="text-lg font-bold text-white">Cochabamba</p>
            </button>
          </div>
          <button onClick={() => setPaso(2)} className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">Siguiente</button>
        </div>
      )}

      {paso === 2 && (
        <div className="space-y-3">
          {disponibles.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl py-12 text-center">
              <Car className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500">No hay vehiculos disponibles en esta ruta</p>
            </div>
          ) : (
            disponibles.map((v) => {
              const libres = (() => {
                const cap = v.capacidadTotal || 12;
                let vendibles = 0;
                if (v.configuracionAsientos && Array.isArray(v.configuracionAsientos.filas)) {
                  vendibles = v.configuracionAsientos.filas
                    .flat()
                    .filter((c): c is number => typeof c === "number").length;
                } else {
                  vendibles = cap;
                }
                vendibles -= (v.asientosChofer?.length || 0);
                return Math.max(0, vendibles - (v.asientosOcupados?.length || 0));
              })();
              return (
                <button key={v.id} onClick={() => { setVehiculoSeleccionado(v); setPaso(3); }}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-sky-500/50 transition-all text-left cursor-pointer">
                  <div className="space-y-1">
                    <p className="text-sky-400 font-mono font-bold">{v.placa}</p>
                    <p className="text-sm text-gray-300">{v.choferNombre} | {v.tipoVehiculo} {v.color}</p>
                    <p className="text-xs text-gray-500">Bs {precioUnitario} por asiento</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${libres > 0 ? "text-emerald-400" : "text-red-400"}`}>{libres}</p>
                    <p className="text-[10px] text-gray-500">asientos</p>
                  </div>
                </button>
              );
            })
          )}
          <button onClick={() => setPaso(1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white cursor-pointer"><ArrowLeft className="w-4 h-4" /> Volver</button>
        </div>
      )}

      {paso === 3 && vehiculoSeleccionado && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2"><Car className="w-5 h-5 text-sky-400" /> Seleccionar asientos - {vehiculoSeleccionado.placa}</h2>
            <DistribucionAsientos
              config={configAsientos}
              asientosChofer={asientosChofer}
              asientosOcupados={ocupados}
              seleccionados={asientosSeleccionados}
              onSeleccionar={(num) => toggleAsiento(num)}
            />
            <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mt-4 justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-600/30 rounded border border-amber-600/30" /> Chofer</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-800 rounded border border-gray-700" /> Disponible</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-sky-600 rounded" /> Seleccionado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600/30 rounded border border-red-600/20" /> Ocupado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-900 rounded border border-dashed border-gray-700" /> Espacio</span>
            </div>
            {asientosSeleccionados.length > 0 && (
              <p className="text-xs text-sky-400 mt-2 text-center">{asientosSeleccionados.length} asiento{asientosSeleccionados.length > 1 ? "s" : ""} seleccionado{asientosSeleccionados.length > 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => stateVehiculo.vehiculo ? navigate("/pasajero/buscar") : setPaso(2)} className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"><ArrowLeft className="w-4 h-4" /> Volver</button>
            {asientosSeleccionados.length > 0 && (
              <button onClick={() => setPaso(4)} className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">Siguiente <ArrowRight className="w-4 h-4" /></button>
            )}
          </div>
        </div>
      )}

      {paso === 4 && vehiculoSeleccionado && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><User className="w-5 h-5 text-sky-400" /> Recibo del comprador</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre completo *</label>
                <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">CI</label>
                <input value={datos.ci} onChange={(e) => setDatos({ ...datos, ci: e.target.value })} placeholder="1234567" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Telefono</label>
                <input value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} placeholder="71234567" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><User className="w-5 h-5 text-amber-400" /> Pasajeros por asiento</h2>
            <p className="text-xs text-gray-400">Ingresa el nombre de cada pasajero que ocupara el asiento</p>
            <div className="space-y-3">
              {asientosSeleccionados.sort((a, b) => a - b).map((asiento) => (
                <div key={asiento} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                  <div className="w-10 h-10 bg-sky-600/20 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-sky-400 font-mono font-bold text-sm">{asiento}</span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Nombre pasajero - Asiento {asiento}</label>
                    <input value={pasajeros[asiento] || ""} onChange={(e) => actualizarNombrePasajero(asiento, e.target.value)} placeholder="Nombre completo del pasajero"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="font-semibold text-white mb-3">Resumen del viaje</h2>
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-400">Ruta</span><span className="text-white">{tramo === "cochabamba" ? "Cochabamba - Eterazama" : "Eterazama - Cochabamba"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Vehiculo</span><span className="text-sky-400 font-mono">{vehiculoSeleccionado.placa}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Chofer</span><span className="text-white">{vehiculoSeleccionado.choferNombre}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Asientos</span><span className="text-white">{asientosSeleccionados.join(", ")}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Pasajes ({asientosSeleccionados.length} x Bs {precioUnitario})</span><span className="text-white">Bs {asientosSeleccionados.length * precioUnitario}</span></div>
              <hr className="border-gray-700" />
              <div className="flex justify-between"><span className="text-gray-400 font-semibold">Total</span><span className="text-green-400 font-bold text-lg">Bs {precioTotal}</span></div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setPaso(3)} className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"><ArrowLeft className="w-4 h-4" /> Volver</button>
            <button onClick={confirmarCompra} disabled={cargando || !todosLosNombresCompletos()} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white px-6 py-2.5 rounded-xl font-medium transition-colors cursor-pointer">
              <QrCode className="w-4 h-4" /> {cargando ? "Procesando..." : "Confirmar y Pagar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
