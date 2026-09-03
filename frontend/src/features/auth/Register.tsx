import { useState } from "react";
import { registroRequest, type RegistroData } from "../../api/auth.api";
import { Link } from "react-router-dom";
import { Bus, Eye, EyeOff, MessageSquare, CheckCircle, AlertCircle, ShieldCheck } from "lucide-react";

type Etapa = "formulario" | "verificar" | "exito";

export default function Register() {
  const [etapa, setEtapa] = useState<Etapa>("formulario");
  const [datos, setDatos] = useState<RegistroData>({
    nombreUsuario: "",
    password: "",
    nombre: "",
    apellidos: "",
    gmail: "",
    telefono: "",
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState("");
  const [codigoIngresado, setCodigoIngresado] = useState("");
  const [detalleCodigo, setDetalleCodigo] = useState("");

  function cambiar(e: React.ChangeEvent<HTMLInputElement>) {
    setDatos({ ...datos, [e.target.name]: e.target.value });
  }

  function validarFormulario(): string {
    if (!datos.nombreUsuario || !datos.password || !datos.nombre || !datos.apellidos) {
      return "Complete los campos obligatorios";
    }
    if (datos.password.length < 6) {
      return "La contrasena debe tener minimo 6 caracteres";
    }
    if (datos.telefono && !/^[0-9]{7,15}$/.test(datos.telefono)) {
      return "El numero de telefono debe contener solo digitos (7-15)";
    }
    if (datos.gmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.gmail)) {
      return "El correo electronico no es valido";
    }
    return "";
  }

  function generarCodigo(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!datos.telefono) {
      setError("Ingresa tu numero de celular para recibir el codigo de verificacion");
      return;
    }

    const valido = validarFormulario();
    if (valido) {
      setError(valido);
      return;
    }

    const codigo = generarCodigo();
    setCodigoEnviado(codigo);
    setDetalleCodigo(codigo);

    const mensaje = encodeURIComponent(
      `*Trans Eterazama* - Codigo de verificacion\n\nTu codigo es: *${codigo}*\n\nIngresalo para completar tu registro.`
    );
    window.open(`https://wa.me/${datos.telefono.replace(/^0+/, "")}?text=${mensaje}`, "_blank");

    setEtapa("verificar");
  }

  function verificarYRegistrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (codigoIngresado.trim() !== codigoEnviado) {
      setError("El codigo de verificacion es incorrecto");
      return;
    }

    setCargando(true);
    registroRequest(datos)
      .then(() => {
        setEtapa("exito");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Error al registrar usuario";
        if (msg.includes("correo")) {
          setError("El correo electronico ya se encuentra registrado");
        } else if (msg.includes("telefono") || msg.includes("número de teléfono")) {
          setError("El numero de telefono ya se encuentra registrado");
        } else if (msg.includes("400")) {
          setError("El nombre de usuario ya existe");
        } else {
          setError(msg);
        }
      })
      .finally(() => setCargando(false));
  }

  if (etapa === "exito") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-400/10 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Cuenta creada!</h2>
            <p className="text-gray-400">Tu numero de celular fue verificado correctamente</p>
            <Link
              to="/"
              className="inline-block bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
            >
              Iniciar sesion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (etapa === "verificar") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600/20 rounded-2xl mb-4">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Verifica tu numero</h1>
            <p className="text-gray-400 mt-2">Ingresa el codigo enviado a tu WhatsApp</p>
          </div>

          <form onSubmit={verificarYRegistrar} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Enviamos un codigo de 6 digitos a tu WhatsApp
                {datos.telefono && <strong className="text-white ml-1">+{datos.telefono}</strong>}
              </span>
            </div>

            <div className="text-center bg-gray-800 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 mb-1">Codigo de prueba (en produccion llega por WhatsApp)</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-white">{detalleCodigo}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Codigo de verificacion *</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Ingresa el codigo de 6 digitos"
                value={codigoIngresado}
                onChange={(e) => setCodigoIngresado(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-white placeholder:text-sm placeholder:text-gray-500 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || codigoIngresado.length !== 6}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creando cuenta...
                </span>
              ) : (
                "Verificar y Crear Cuenta"
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setEtapa("formulario"); setCodigoIngresado(""); }}
                className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Volver al formulario
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-sky-600/20 rounded-2xl mb-4">
            <Bus className="w-8 h-8 text-sky-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Crear Cuenta</h1>
          <p className="text-gray-400 mt-2">Registrate en Trans Eterazama</p>
        </div>

        <form onSubmit={enviarCodigo} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre de usuario *</label>
            <input
              type="text"
              name="nombreUsuario"
              placeholder="ej: juan123"
              value={datos.nombreUsuario}
              onChange={cambiar}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label>
              <input
                type="text"
                name="nombre"
                placeholder="Nombre"
                value={datos.nombre}
                onChange={cambiar}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Apellidos *</label>
              <input
                type="text"
                name="apellidos"
                placeholder="Apellidos"
                value={datos.apellidos}
                onChange={cambiar}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Correo electronico *</label>
            <input
              type="email"
              name="gmail"
              placeholder="ej: juan@gmail.com"
              value={datos.gmail || ""}
              onChange={cambiar}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Numero de celular *</label>
            <input
              type="tel"
              name="telefono"
              placeholder="ej: 71234567"
              value={datos.telefono || ""}
              onChange={(e) => setDatos({ ...datos, telefono: e.target.value.replace(/[^0-9]/g, "") })}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">Recibiras un codigo de verificacion por WhatsApp</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Contrasena *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Minimo 6 caracteres"
                value={datos.password}
                onChange={cambiar}
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
            disabled={cargando}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
          >
            <span className="flex items-center justify-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Enviar codigo de verificacion
            </span>
          </button>

          <div className="text-center text-sm text-gray-400">
            Ya tienes cuenta?{" "}
            <Link to="/" className="text-sky-400 hover:text-sky-300 transition-colors">
              Inicia sesion
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}