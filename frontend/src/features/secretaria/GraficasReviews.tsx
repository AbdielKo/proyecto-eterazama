import { useEffect, useState } from "react";
import { obtenerNomina, obtenerGraficasChofer, type NominaItem, type GraficaChofer } from "../../api/secretaria.api";
import { Star, BarChart3, TrendingUp, MessageSquare, Users, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function GraficasReviews() {
  const [choferes, setChoferes] = useState<NominaItem[]>([]);
  const [choferId, setChoferId] = useState("");
  const [periodo, setPeriodo] = useState("mes");
  const [datos, setDatos] = useState<GraficaChofer | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    obtenerNomina().then(setChoferes).catch(console.error);
  }, []);

  useEffect(() => {
    if (!choferId) {
      setDatos(null);
      return;
    }
    setCargando(true);
    obtenerGraficasChofer(choferId, periodo)
      .then(setDatos)
      .catch(() => setDatos(null))
      .finally(() => setCargando(false));
  }, [choferId, periodo]);

  const distribucion = [5, 4, 3, 2, 1].map((s) => ({
    estrellas: s,
    cantidad: datos?.distribucion?.[s] ?? 0,
  }));

  const choferSeleccionado = choferes.find((c) => c.id === choferId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Graficas de Calificaciones</h1>
          <p className="text-gray-400 text-sm mt-0.5">Selecciona un chofer para ver sus calificaciones</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={choferId}
              onChange={(e) => setChoferId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none cursor-pointer"
            >
              <option value="">Seleccionar chofer...</option>
              {choferes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombreCompleto} {c.placa ? `(${c.placa})` : ""}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>
          <div className="flex gap-0.5 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
            {["dia", "semana", "mes"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  periodo === p ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {p === "dia" ? "Dia" : p === "semana" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!choferId ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Selecciona un chofer para ver sus graficas</p>
        </div>
      ) : cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-gray-500 text-sm">Cargando datos...</p>
        </div>
      ) : datos ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <Star className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-[11px] text-gray-500">Promedio</p>
                <p className="text-2xl font-bold text-white">{datos.promedio}</p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-[11px] text-gray-500">Total resenas</p>
                <p className="text-2xl font-bold text-white">{datos.cantidad}</p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-[11px] text-gray-500">Placa</p>
                <p className="text-2xl font-bold text-sky-400 font-mono">{datos.placa || "-"}</p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-[11px] text-gray-500">Con comentario</p>
                <p className="text-2xl font-bold text-white">{datos.comentarios.filter((c) => c.comentario).length}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" /> Evolucion de puntuacion
              </h3>
              {datos.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={datos.chartData}>
                    <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
                    <Line type="monotone" dataKey="promedio" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: "#0ea5e9", r: 4 }} name="Promedio" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-sm text-center py-10">Sin datos en este periodo</p>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" /> Distribucion por estrellas
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={distribucion} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="estrellas" tick={{ fontSize: 11, fill: "#6b7280" }} width={30} />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="cantidad" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Resenas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" /> Comentarios de {choferSeleccionado?.nombreCompleto}
            </h3>
            {datos.comentarios.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Sin comentarios</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {datos.comentarios.slice(0, 20).map((r) => (
                  <div key={r.id} className="bg-gray-800 rounded-xl p-3 flex items-start gap-3">
                    <div className="flex gap-0.5 shrink-0 mt-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= r.estrellas ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}`} />
                      ))}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-300">{r.comentario || "Sin comentario"}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-gray-500 text-sm">Este chofer aun no tiene calificaciones</p>
        </div>
      )}
    </div>
  );
}
