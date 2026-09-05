import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "../features/auth/Login";
import Register from "../features/auth/Register";

import MainLayout from "../layouts/MainLayout";
import ChoferLayout from "../layouts/ChoferLayout";
import PasajeroLayout from "../layouts/PasajeroLayout";

import Dashboard from "../features/secretaria/Dashboard";
import GestionFila from "../features/secretaria/GestionFila";
import ChoferesActivos from "../features/secretaria/ChoferesActivos";
import Boleteria from "../features/secretaria/Boleteria";
import CajaCentral from "../features/secretaria/CajaCentral";
import HistorialVentas from "../features/secretaria/HistorialVentas";
import NominaChoferes from "../features/secretaria/NominaChoferes";
import Usuarios from "../features/secretaria/Usuarios";
import ReviewsChoferes from "../features/secretaria/ReviewsChoferes";
import GraficasReviews from "../features/secretaria/GraficasReviews";
import Reportes from "../features/secretaria/Reportes";
import Configuracion from "../features/secretaria/Configuracion";
import Reembolsos from "../features/secretaria/Reembolsos";
import Perfil from "../features/secretaria/Perfil";
import NotificacionesSecretaria from "../features/secretaria/NotificacionesSecretaria";

import PasajeroInicio from "../features/pasajero/PasajeroInicio";
import BuscarViaje from "../features/pasajero/BuscarViaje";
import ComprarPasaje from "../features/pasajero/ComprarPasaje";
import MisPasajes from "../features/pasajero/MisPasajes";
import MisBoletos from "../features/pasajero/MisBoletos";
import HistorialViajes from "../features/pasajero/HistorialViajes";
import CalificarServicio from "../features/pasajero/CalificarServicio";
import MisResenas from "../features/pasajero/MisResenas";
import Favoritos from "../features/pasajero/Favoritos";
import PerfilPasajero from "../features/pasajero/PerfilPasajero";
import Notificaciones from "../features/pasajero/Notificaciones";
import Ayuda from "../features/pasajero/Ayuda";

import Inicio from "../features/chofer/Inicio";
import MiVehiculo from "../features/chofer/MiVehiculo";
import MiFila from "../features/chofer/MiFila";
import EscanearQR from "../features/chofer/EscanearQR";
import EstadoViaje from "../features/chofer/EstadoViaje";
import HistorialViajesChofer from "../features/chofer/HistorialViajesChofer";
import MisEstadisticas from "../features/chofer/MisEstadisticas";
import NotificacionesChofer from "../features/chofer/NotificacionesChofer";
import PerfilChofer from "../features/chofer/PerfilChofer";

import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />
        <Route path="/registro" element={<Register />} />

        {/* Secretaria */}
        <Route
          path="/secretaria"
          element={
            <ProtectedRoute>
              <RoleRoute rol="secretaria">
                <MainLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="fila" element={<GestionFila />} />
          <Route path="choferes-activos" element={<ChoferesActivos />} />
          <Route path="boleteria" element={<Boleteria />} />
          <Route path="caja" element={<CajaCentral />} />
          <Route path="historial" element={<HistorialVentas />} />
          <Route path="choferes" element={<NominaChoferes />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="calificaciones" element={<ReviewsChoferes />} />
          <Route path="graficas" element={<GraficasReviews />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="reembolsos" element={<Reembolsos />} />
          <Route path="notificaciones" element={<NotificacionesSecretaria />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="perfil" element={<Perfil />} />
        </Route>

        {/* Pasajero */}
        <Route
          path="/pasajero"
          element={
            <ProtectedRoute>
              <RoleRoute rol="pasajero">
                <PasajeroLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<PasajeroInicio />} />
          <Route path="buscar" element={<BuscarViaje />} />
          <Route path="comprar" element={<ComprarPasaje />} />
          <Route path="mis-pasajes" element={<MisPasajes />} />
          <Route path="boletos" element={<MisBoletos />} />
          <Route path="historial" element={<HistorialViajes />} />
          <Route path="calificar" element={<CalificarServicio />} />
          <Route path="resenas" element={<MisResenas />} />
          <Route path="favoritos" element={<Favoritos />} />
          <Route path="notificaciones" element={<Notificaciones />} />
          <Route path="perfil" element={<PerfilPasajero />} />
          <Route path="ayuda" element={<Ayuda />} />
        </Route>

        {/* Chofer */}
        <Route
          path="/chofer"
          element={
            <ProtectedRoute>
              <RoleRoute rol="chofer">
                <ChoferLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Inicio />} />
          <Route path="vehiculo" element={<MiVehiculo />} />
          <Route path="fila" element={<MiFila />} />
          <Route path="escanear-qr" element={<EscanearQR />} />
          <Route path="estado-viaje" element={<EstadoViaje />} />
          <Route path="historial" element={<HistorialViajesChofer />} />
          <Route path="estadisticas" element={<MisEstadisticas />} />
          <Route path="notificaciones" element={<NotificacionesChofer />} />
          <Route path="perfil" element={<PerfilChofer />} />
        </Route>

        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
