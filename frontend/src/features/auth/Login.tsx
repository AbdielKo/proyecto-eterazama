import { useEffect, useState } from "react";
import { loginRequest } from "../../api/auth.api";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Bus, Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";

function extraerMinutosBloqueo(mensaje: string): number | null {
  const match = mensaje.match(/(\d+)\s*minuto/i);
  if (!match) return null;
  return Number(match[1]);
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [bloqueoHasta, setBloqueoHasta] = useState<Date | null>(null);
  const [ahora, setAhora] = useState(() => new Date());
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!bloqueoHasta) return;
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [bloqueoHasta]);

  useEffect(() => {
    if (bloqueoHasta && new Date() >= bloqueoHasta) {
      setBloqueoHasta(null);
      setError("");
    }
  }, [ahora, bloqueoHasta]);

  const segundosRestantes = bloqueoHasta
    ? Math.max(0, Math.floor((bloqueoHasta.getTime() - new Date().getTime()) / 1000))
    : 0;
  const mm = Math.floor(segundosRestantes / 60);
  const ss = segundosRestantes % 60;
  const tiempoRestante = `${mm}:${String(ss).padStart(2, "0")}`;

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!usuario || !password) {
      setError("Complete usuario y contraseña");
      return;
    }

    try {
      setCargando(true);
      const respuesta = await loginRequest(usuario, password);
      login(respuesta.usuario, respuesta.access_token);

      const rol = respuesta.usuario.rol.toLowerCase().trim();
      if (rol === "secretaria") navigate("/secretaria");
      else if (rol === "chofer") navigate("/chofer");
      else navigate("/pasajero");
    } catch (e: any) {
      const mensaje = e?.response?.data?.message;
      const texto = mensaje || "Usuario o contraseña incorrectos";

      if (texto.toLowerCase().includes("bloqueado temporalmente")) {
        const minutos = extraerMinutosBloqueo(texto);
        if (minutos) {
          setBloqueoHasta(new Date(Date.now() + minutos * 60 * 1000));
        }
      }
      setError(texto);
    } finally {
      setCargando(false);
    }
  }

  const enBloqueo = bloqueoHasta !== null && segundosRestantes > 0;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-600/20 rounded-2xl mb-4">
            <Bus className="w-8 h-8 text-sky-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Trans Eterazama</h1>
          <p className="text-gray-400 mt-2">Plataforma Oficial de Boleteria</p>
        </div>

        <form onSubmit={ingresar} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
              {enBloqueo || error.toLowerCase().includes("bloqueada") ? (
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div>
                {error}
                {enBloqueo && (
                  <p className="mt-1 font-mono text-base font-semibold text-red-300">
                    Reintento disponible en {tiempoRestante}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Usuario</label>
            <input
              type="text"
              placeholder="Ingrese su usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Contrasena</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Ingrese su contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando || enBloqueo}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
          >
            {cargando ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Ingresando...
              </span>
            ) : enBloqueo ? (
              `Espera ${tiempoRestante}`
            ) : (
              "Ingresar"
            )}
          </button>

          <div className="text-center text-sm text-gray-400">
            No tienes cuenta?{" "}
            <Link to="/registro" className="text-sky-400 hover:text-sky-300 transition-colors">
              Registrate aqui
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
