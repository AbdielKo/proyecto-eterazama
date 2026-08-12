const API_URL = 'http://localhost:3000';

class ApiService {
    static async request(endpoint, method = 'GET', data = null, token = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = { method, headers };
        if (data) config.body = JSON.stringify(data);

        if (window.mostrarSpinner) window.mostrarSpinner(true);

        try {
            const response = await fetch(`${API_URL}${endpoint}`, config);
            const resData = await response.json();
            
            if (window.mostrarSpinner) window.mostrarSpinner(false);

            if (!response.ok) {
                const mensaje = Array.isArray(resData.message) ? resData.message.join(', ') : (resData.message || 'Error en el servidor');
                throw new Error(mensaje);
            }
            return resData;
        } catch (err) {
            if (window.mostrarSpinner) window.mostrarSpinner(false);
            console.error(`API Error [${endpoint}]:`, err.message);
            throw err;
        }
    }

    static login(nombreUsuario, password) {
        return this.request('/auth/login', 'POST', { nombreUsuario, password });
    }

    static registro(data) {
        return this.request('/auth/registro', 'POST', data);
    }

    static loginGoogle(googleToken) {
        return this.request('/auth/google', 'POST', { token: googleToken });
    }

    static buscarUsuarioCriterio(criterio) {
        return this.request('/auth/buscar', 'POST', { criterio });
    }

    static restablecerPassword(userId, nuevaPassword) {
        return this.request(`/auth/restablecer/${userId}`, 'POST', { nuevaPassword });
    }

    static obtenerChoferes() {
        return this.request('/flota/todos'); // Carga directamente la flota completa como nómina
    }

    static actualizarChofer(userId, data) {
        return this.request(`/auth/chofer/${userId}`, 'POST', data, typeof tokenSesion !== 'undefined' ? tokenSesion : null);
    }

    static obtenerFlotaCompleta() {
        return this.request('/flota/todos');
    }

    static obtenerPorParada(parada) {
        return this.request(`/flota/parada/${parada}`);
    }

    static crearVehiculo(data) {
        return this.request('/flota/nuevo', 'POST', data, typeof tokenSesion !== 'undefined' ? tokenSesion : null);
    }

    static ocuparAsientos(vehiculoId, asientos) {
        return this.request(`/flota/${vehiculoId}/ocupar`, 'POST', { asientos });
    }

    static trasladarVehiculo(vehiculoId, parada) {
        return this.request(`/flota/${vehiculoId}/trasladar`, 'POST', { parada });
    }

    static reordenarFila(cambios) {
        return this.request('/flota/reordenar', 'POST', cambios);
    }

    static eliminarVehiculo(vehiculoId) {
        return this.request(`/flota/${vehiculoId}`, 'DELETE');
    }

    static registrarVenta(data) {
        return this.request('/pasajes/venta', 'POST', data);
    }

    static obtenerHistorial() {
        return this.request('/pasajes/historial');
    }

    static obtenerCajaCentral() {
        return this.request('/pasajes/caja');
    }

    static obtenerVentasHoy() {
        return this.request('/pasajes/hoy');
    }

    static descargarPdfComprobante(pasajeId) {
        window.open(`${API_URL}/pasajes/${pasajeId}/pdf`, '_blank');
    }
}