let usuarioSesion = null;
let tokenSesion = null;
let listadoFlotaGlobal = [];
let ultimoPasajeGuardado = null;
let modoAuthRegistro = false;
let usuarioEncontradoRecuperacion = null;
let base64QrSeleccionado = null;
let debounceTimerSearch = null;
let choferSeleccionadoEdicion = null;
let cropperInstance = null;

let rutaInvertidaPasajero = false;
let cocheSeleccionadoPasajero = null;
let asientosPasajeroElegidos = [];

let paradaFiltroChofer = "cochabamba";
let asientosMarcadosChofer = [];
let precioBaseChofer = 15;
let precioEncomiendaChofer = 0;
let tieneEncomiendaChofer = false;

let cocheSecSeleccionado = null;
let asientosSecElegidos = [];

// --- WEBSOCKETS TIEMPO REAL ---
const socket = io('http://localhost:3000');

socket.on('flotaActualizada', () => {
    cargarFlota().then(() => {
        if (usuarioSesion) {
            const rol = usuarioSesion.rol.toLowerCase().trim();
            if (rol === 'secretaria') renderizerParadasSinBucle();
            else if (rol === 'chofer') refrescarChoferPanel();
            else renderizarListaPasajero();
        } else {
            renderizarListaPasajero();
        }
    });
});

function renderizerParadasSinBucle() {
    renderizarAdminParadas();
    renderizarAdminBoleteriaVentanilla();
    renderizarAdminRuta();
    obtenerCajaCentralAPI();
}

// --- SISTEMA DE TOASTS Y SPINNER ---
function showToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensaje;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function mostrarSpinner(activar) {
    const overlay = document.getElementById('spinner-global');
    if (overlay) overlay.style.display = activar ? 'flex' : 'none';
}
window.mostrarSpinner = mostrarSpinner;

// --- LOGIN, REGISTRO Y GOOGLE AUTH ---
function alternarModoAuth() {
    modoAuthRegistro = !modoAuthRegistro;
    
    if (modoAuthRegistro) {
        document.getElementById('panel-login-form').style.display = 'none';
        document.getElementById('panel-social-auth').style.display = 'none';
        document.getElementById('panel-registro-form').style.display = 'block';
        document.getElementById('lbl-auth-title').innerText = "Nueva Cuenta";
        document.getElementById('lbl-auth-subtitle').innerText = "Crea tu perfil de pasajero en Trans Eterazama";
    } else {
        document.getElementById('panel-registro-form').style.display = 'none';
        document.getElementById('panel-login-form').style.display = 'block';
        document.getElementById('panel-social-auth').style.display = 'block';
        document.getElementById('lbl-auth-title').innerText = "Trans Eterazama";
        document.getElementById('lbl-auth-subtitle').innerText = "Plataforma Oficial de Boletería";
    }
}

async function iniciarSesionAPI() {
    const user = document.getElementById('txt-login-user').value.trim();
    const pass = document.getElementById('txt-login-pass').value;

    if (!user || !pass) return showToast("Ingrese usuario y contraseña", "warning");

    try {
        const res = await ApiService.login(user, pass);
        procesarInicioExitoso(res);
    } catch (err) {
        showToast(err.message || "Credenciales incorrectas", "error");
    }
}

async function crearCuentaNueva() {
    const nombre = document.getElementById('txt-reg-nombre').value.trim();
    const apellidos = document.getElementById('txt-reg-apellidos').value.trim();
    const user = document.getElementById('txt-reg-user').value.trim();
    const gmail = document.getElementById('txt-reg-gmail').value.trim();
    const telefono = document.getElementById('txt-reg-phone').value.trim();
    const pass = document.getElementById('txt-reg-pass').value;

    if (!user || !pass || !nombre || !apellidos) {
        return showToast("Por favor complete los campos obligatorios", "warning");
    }

    try {
        await ApiService.registro({
            nombreUsuario: user,
            password: pass,
            nombre: nombre,
            apellidos: apellidos,
            gmail: gmail || null,
            telefono: telefono || null,
            rol: 'pasajero'
        });

        showToast("✔ Cuenta creada exitosamente. Inicie sesión.", "success");
        alternarModoAuth();
        document.getElementById('txt-login-user').value = user;
    } catch (err) {
        showToast(err.message || "Error al crear la cuenta", "error");
    }
}

async function handleCredentialResponse(response) {
    try {
        const res = await ApiService.loginGoogle(response.credential);
        procesarInicioExitoso(res);
        showToast("✔ Sesión iniciada con Google", "success");
    } catch (err) {
        showToast("Error al autenticar con Google", "error");
    }
}
window.handleCredentialResponse = handleCredentialResponse;

function procesarInicioExitoso(res) {
    usuarioSesion = res.usuario;
    tokenSesion = res.access_token;

    document.getElementById('view-login').style.display = 'none';
    document.getElementById('global-header').style.display = 'flex';
    document.getElementById('lbl-global-role').innerText = usuarioSesion.rol.toUpperCase();

    document.getElementById('view-usuario').style.display = 'none';
    document.getElementById('view-chofer').style.display = 'none';
    document.getElementById('view-secretaria').style.display = 'none';

    cargarFlota().then(() => {
        const rolNormalizado = usuarioSesion.rol.toLowerCase().trim();

        if (rolNormalizado === 'secretaria') {
            document.getElementById('view-secretaria').style.display = 'block';
            renderizarAdminCompleto();
        } else if (rolNormalizado === 'chofer') {
            document.getElementById('lbl-nombre-chofer').innerText = usuarioSesion.nombreUsuario;
            document.getElementById('view-chofer').style.display = 'flex';
            refrescarChoferPanel();
        } else {
            document.getElementById('view-usuario').style.display = 'block';
            renderizarListaPasajero();
        }
        showToast(`Bienvenido ${usuarioSesion.nombreCompleto || usuarioSesion.nombreUsuario}`, "success");
    });
}

function logoutGlobal() {
    usuarioSesion = null;
    tokenSesion = null;

    document.getElementById('global-header').style.display = 'none';
    document.getElementById('view-usuario').style.display = 'none';
    document.getElementById('view-asientos-pasajero').style.display = 'none';
    document.getElementById('view-qr-pasajero').style.display = 'none';
    document.getElementById('view-chofer').style.display = 'none';
    document.getElementById('view-secretaria').style.display = 'none';
    document.getElementById('view-login').style.display = 'block';
    showToast("Sesión cerrada correctamente", "info");
}

async function cargarFlota() {
    try {
        listadoFlotaGlobal = await ApiService.obtenerFlotaCompleta();
    } catch (err) {
        showToast("Error conectando con la API del servidor", "error");
    }
}

// --- MÓDULO PASAJERO ---
function invertirRutaPasajero() {
    rutaInvertidaPasajero = !rutaInvertidaPasajero;
    document.getElementById('label-origen').innerText = rutaInvertidaPasajero ? "Eterazama" : "Cochabamba";
    document.getElementById('label-destino').innerText = rutaInvertidaPasajero ? "Cochabamba" : "Eterazama";
    document.getElementById('lbl-inicio-monto').innerText = rutaInvertidaPasajero ? "18.00 Bs" : "15.00 Bs";
    renderizarListaPasajero();
}

function renderizarListaPasajero() {
    const cont = document.getElementById('lista-vehiculos-pasajero');
    cont.innerHTML = '';
    const paradaTarget = rutaInvertidaPasajero ? "eterazama" : "cochabamba";
    const lista = listadoFlotaGlobal.filter(v => v.paradaActual === paradaTarget);

    if (lista.length === 0) {
        cont.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">No hay vehículos disponibles en esta parada actualmente.</p>`;
        return;
    }

    lista.forEach(v => {
        const row = document.createElement('div');
        row.className = "fila-vehiculo libre";
        row.onclick = () => abrirMapaPasajero(v);
        row.innerHTML = `
            <div><span class="color-indicator" style="background:#06b6d4;"></span>${v.color}</div>
            <div>${v.placa}</div>
            <div>${v.choferNombre} (${v.tipoVehiculo})</div>
            <div style="text-align:right; color:var(--neon-green);">DISPONIBLE</div>
        `;
        cont.appendChild(row);
    });
}

function abrirMapaPasajero(v) {
    cocheSeleccionadoPasajero = v;
    asientosPasajeroElegidos = [];
    document.getElementById('view-usuario').style.display = 'none';
    document.getElementById('view-asientos-pasajero').style.display = 'block';
    document.getElementById('lbl-pasajero-bus-titulo').innerText = `${v.choferNombre} [${v.placa}]`;

    const grid = document.getElementById('grid-asientos-pasajero'); grid.innerHTML = '';
    const ocupados = v.asientosOcupados || [];

    for (let i = 1; i <= 16; i++) {
        const s = document.createElement('div'); s.className = "seat"; s.innerText = i;
        if (ocupados.includes(i)) s.classList.add('occupied');
        else {
            s.addEventListener('click', () => {
                if (asientosPasajeroElegidos.includes(i)) {
                    asientosPasajeroElegidos = asientosPasajeroElegidos.filter(x => x !== i);
                    s.classList.remove('selected');
                } else {
                    asientosPasajeroElegidos.push(i);
                    s.classList.add('selected');
                }
                recalcularPasajeroBoton();
            });
        }
        grid.appendChild(s);
    }
    recalcularPasajeroBoton();
}

function recalcularPasajeroBoton() {
    const btn = document.getElementById('btn-comprar-pasajero');
    const precio = rutaInvertidaPasajero ? 18 : 15;
    if (asientosPasajeroElegidos.length > 0) {
        btn.disabled = false; btn.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        btn.innerText = `Comprar (${asientosPasajeroElegidos.length}) Asientos — Total: ${(asientosPasajeroElegidos.length * precio).toFixed(2)} Bs`;
    } else {
        btn.disabled = true; btn.style.background = "#475569";
        btn.innerText = "Seleccione asientos";
    }
}

async function confirmarCompraPasajero() {
    if (!cocheSeleccionadoPasajero) return;
    const precioUnitario = rutaInvertidaPasajero ? 18 : 15;
    const total = asientosPasajeroElegidos.length * precioUnitario;

    try {
        const res = await ApiService.registrarVenta({
            vehiculoId: cocheSeleccionadoPasajero.id,
            pasajeroNombre: usuarioSesion ? (usuarioSesion.nombreCompleto || usuarioSesion.nombreUsuario) : 'Pasajero Web',
            placaVehiculo: cocheSeleccionadoPasajero.placa,
            asientos: asientosPasajeroElegidos,
            montoAsientos: total,
            montoEncomienda: 0,
            tramo: rutaInvertidaPasajero ? 'Eterazama ➔ Cochabamba' : 'Cochabamba ➔ Eterazama'
        });

        ultimoPasajeGuardado = res;
        await cargarFlota();
        document.getElementById('btn-comprar-pasajero').style.display = 'none';
        document.getElementById('btn-qr-pasajero').style.display = 'block';
        showToast("¡Reserva guardada exitosamente!", "success");
    } catch (err) {
        showToast(err.message || "Error registrando la compra", "error");
    }
}

function mostrarPantallaQRFinal() {
    const precioUnitario = rutaInvertidaPasajero ? 18 : 15;
    document.getElementById('lbl-qr-asientos').innerText = asientosPasajeroElegidos.join(', ');
    document.getElementById('lbl-qr-monto').innerText = (asientosPasajeroElegidos.length * precioUnitario).toFixed(2) + " Bs";
    
    const qrContainer = document.getElementById('qr-real-container');
    qrContainer.innerHTML = '';
    const qrText = ultimoPasajeGuardado ? `BOLETO:${ultimoPasajeGuardado.id}|PLACA:${ultimoPasajeGuardado.placaVehiculo}` : "TRANS_ETERAZAMA_RESERVA";
    new QRCode(qrContainer, {
        text: qrText,
        width: 150,
        height: 150,
    });

    document.getElementById('view-asientos-pasajero').style.display = 'none';
    document.getElementById('view-qr-pasajero').style.display = 'block';
}

function descargarComprobantePdfActual() {
    if (ultimoPasajeGuardado) {
        ApiService.descargarPdfComprobante(ultimoPasajeGuardado.id);
    } else {
        showToast("No hay un boleto guardado para descargar", "warning");
    }
}

function desplegarPanelReciboQR() { document.getElementById('panel-canales-qr').style.display = 'block'; }
function activarInputQR(tipo) { document.getElementById('input-container-qr').style.display = 'block'; }
function enviarReciboSimuladoQR() { showToast("✔ Recibo enviado exitosamente", "success"); document.getElementById('panel-canales-qr').style.display = 'none'; }
function regresarAlInicioPasajero() {
    document.getElementById('view-qr-pasajero').style.display = 'none';
    document.getElementById('btn-comprar-pasajero').style.display = 'flex';
    document.getElementById('btn-qr-pasajero').style.display = 'none';
    document.getElementById('view-usuario').style.display = 'block';
    renderizarListaPasajero();
}
function regresarAListaPasajero() {
    document.getElementById('view-asientos-pasajero').style.display = 'none';
    document.getElementById('view-usuario').style.display = 'block';
}

// --- MÓDULO CHOFER ---
function volverInicioChofer() { document.querySelectorAll('#view-chofer .sub-panel-overlay').forEach(p => p.style.display = 'none'); }
function alternarSubPanelChofer(id) {
    const panel = document.getElementById(id);
    if (panel.style.display === 'block') panel.style.display = 'none';
    else {
        document.querySelectorAll('#view-chofer .sub-panel-overlay').forEach(p => p.style.display = 'none');
        panel.style.display = 'block';
    }
}
function cerrarSubPanelChofer(id) { document.getElementById(id).style.display = 'none'; }

function refrescarChoferPanel() {
    const miTurno = listadoFlotaGlobal.find(v => v.choferNombre === (usuarioSesion ? usuarioSesion.nombreUsuario : ''));
    const badge = document.getElementById('lbl-chofer-puesto-actual');
    const zonaBtn = document.getElementById('zona-botones-fila');

    if (miTurno) {
        badge.innerText = `${miTurno.puestoFila}° en Fila`;
        precioBaseChofer = miTurno.paradaActual === 'cochabamba' ? 15 : 18;
        zonaBtn.innerHTML = `<button class="btn-touch-action btn-red" onclick="trasladarMiVehiculo('en_ruta')">❌ Salir a Ruta</button>`;
    } else {
        badge.innerText = "En Ruta";
        precioBaseChofer = 15;
        zonaBtn.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <button class="btn-touch-action btn-blue" onclick="trasladarMiVehiculo('cochabamba')">📥 Fila Cbba</button>
                <button class="btn-touch-action btn-blue" onclick="trasladarMiVehiculo('eterazama')">📥 Fila Ete</button>
            </div>
        `;
    }
    dibujarListaCompanerosChofer();
    dibujarMatrizAsientosChofer(miTurno);
}

async function trasladarMiVehiculo(paradaTarget) {
    const miTurno = listadoFlotaGlobal.find(v => v.choferNombre === usuarioSesion.nombreUsuario);
    if (miTurno) {
        try {
            await ApiService.trasladarVehiculo(miTurno.id, paradaTarget);
            await cargarFlota();
            refrescarChoferPanel();
            showToast(`Estado actualizado: ${paradaTarget}`, "info");
        } catch (err) {
            showToast("No se pudo trasladar el vehículo", "error");
        }
    }
}

function cambiarFiltroChofer(parada) {
    paradaFiltroChofer = parada;
    dibujarListaCompanerosChofer();
}

function dibujarListaCompanerosChofer() {
    const cont = document.getElementById('lista-compañeros-chofer'); cont.innerHTML = '';
    const list = listadoFlotaGlobal.filter(x => x.paradaActual === paradaFiltroChofer);

    list.forEach(v => {
        const row = document.createElement('div');
        row.className = v.choferNombre === usuarioSesion.nombreUsuario ? "chofer-row-list propio" : "chofer-row-list";
        row.innerHTML = `<span>👤 <b>${v.choferNombre}</b> [${v.placa}]</span><span>${v.puestoFila}° Puesto</span>`;
        cont.appendChild(row);
    });
}

function dibujarMatrizAsientosChofer(miTurno) {
    const grid = document.getElementById('grid-asientos-chofer'); grid.innerHTML = '';
    asientosMarcadosChofer = [];
    const ocupados = miTurno ? (miTurno.asientosOcupados || []) : [];

    for (let i = 1; i <= 16; i++) {
        const s = document.createElement('div'); s.className = "seat"; s.innerText = i;
        if (ocupados.includes(i)) s.classList.add('occupied');
        else {
            s.addEventListener('click', () => {
                if (asientosMarcadosChofer.includes(i)) {
                    asientosMarcadosChofer = asientosMarcadosChofer.filter(x => x !== i);
                    s.classList.remove('selected');
                } else {
                    asientosMarcadosChofer.push(i);
                    s.classList.add('selected');
                }
                recalcularChoferTotales();
            });
        }
        grid.appendChild(s);
    }
    recalcularChoferTotales();
}

function cambiarTipoPasajeroChofer(tipo) {
    if (tipo === 'Encomienda') {
        document.getElementById('backdrop-encomienda').style.display = 'flex';
    } else {
        quitarEncomiendaDeSuma();
    }
}
function setPrecioModalRapido(val) { document.getElementById('txt-precio-modal-input').value = val; }
function cancelarPestañaEncomienda() { document.getElementById('backdrop-encomienda').style.display = 'none'; }
function quitarEncomiendaDeSuma() {
    precioEncomiendaChofer = 0; tieneEncomiendaChofer = false;
    document.getElementById('backdrop-encomienda').style.display = 'none';
    recalcularChoferTotales();
}
function aceptarPrecioPestañaEncomienda() {
    let val = parseFloat(document.getElementById('txt-precio-modal-input').value);
    if (!isNaN(val) && val >= 0) {
        precioEncomiendaChofer = val; tieneEncomiendaChofer = precioEncomiendaChofer > 0;
        document.getElementById('backdrop-encomienda').style.display = 'none';
        recalcularChoferTotales();
    }
}

function recalcularChoferTotales() {
    const subtotal = asientosMarcadosChofer.length * precioBaseChofer;
    const total = subtotal + precioEncomiendaChofer;
    document.getElementById('lbl-asientos-chofer-txt').innerText = asientosMarcadosChofer.join(', ') || "Ninguno";
    document.getElementById('lbl-subtotal-asientos-chofer').innerText = subtotal.toFixed(2) + " Bs";
    document.getElementById('lbl-subtotal-encomienda-chofer').innerText = precioEncomiendaChofer.toFixed(2) + " Bs";
    document.getElementById('lbl-total-chofer-txt').innerText = total.toFixed(2) + " Bs";
    document.getElementById('btn-confirmar-venta-chofer').disabled = (asientosMarcadosChofer.length === 0 && !tieneEncomiendaChofer);
}

function desplegarPanelReciboChofer() { document.getElementById('panel-canales-chofer').style.display = 'block'; }
function activarInputChofer(c) { document.getElementById('input-container-chofer').style.display = 'block'; }

async function procesarVentaChoferFinal() {
    const miTurno = listadoFlotaGlobal.find(v => v.choferNombre === usuarioSesion.nombreUsuario);
    if (!miTurno) return showToast("Debes estar en la fila para vender pasajes", "warning");

    const subtotal = asientosMarcadosChofer.length * precioBaseChofer;

    try {
        await ApiService.registrarVenta({
            vehiculoId: miTurno.id,
            pasajeroNombre: "Pasajero Abordo",
            placaVehiculo: miTurno.placa,
            asientos: asientosMarcadosChofer,
            montoAsientos: subtotal,
            montoEncomienda: precioEncomiendaChofer,
            tramo: miTurno.paradaActual === 'cochabamba' ? 'Cochabamba ➔ Eterazama' : 'Eterazama ➔ Cochabamba'
        });

        await cargarFlota();
        precioEncomiendaChofer = 0; tieneEncomiendaChofer = false;
        document.getElementById('panel-canales-chofer').style.display = 'none';
        refrescarChoferPanel();
        cerrarSubPanelChofer('sub-panel-mi-boleteria');
        showToast("✔ Venta procesada y sincronizada", "success");
    } catch (err) {
        showToast(err.message || "Error registrando la venta", "error");
    }
}

// --- MÓDULO ADMINISTRACIÓN SECRETARÍA ---
function cambiarSubModuloAdmin(id, btn) {
    document.querySelectorAll('#view-secretaria .btn-menu').forEach(b => b.classList.remove('active-menu'));
    document.querySelectorAll('#view-secretaria .sub-view').forEach(v => v.classList.remove('active-sub'));
    btn.classList.add('active-menu');
    document.getElementById('sub-' + id).classList.add('active-sub');

    if (id === 'lista-choferes') {
        renderizarNominaConductores();
    }
}

function renderizarAdminCompleto() {
    renderizarAdminParadas();
    renderizarAdminBoleteriaVentanilla();
    renderizarAdminRuta();
    renderizarNominaConductores();
    obtenerCajaCentralAPI();
    obtenerHistorialAPI();
}

function renderizarAdminParadas() {
    const colCbba = document.getElementById('lista-admin-parada-cbba');
    const colEte = document.getElementById('lista-admin-parada-ete');
    colCbba.innerHTML = ''; colEte.innerHTML = '';

    listadoFlotaGlobal.forEach(v => {
        if (v.paradaActual === 'fuera_de_fila') return;

        const card = document.createElement('div'); card.className = "admin-car-card";
        card.innerHTML = `
            <div style="display:flex; align-items:center;">
                <input type="number" class="input-puesto-fila" value="${v.puestoFila}" data-id="${v.id}">
                <div style="margin-left:10px;"><b>${v.choferNombre}</b><br><small style="color:var(--text-muted);">${v.tipoVehiculo} [${v.placa}]</small></div>
            </div>
            <button style="background:transparent; border:none; color:var(--neon-red); cursor:pointer; font-size:1rem;" title="Eliminar de la fila" onclick="eliminarVehiculoAdmin(${v.id})">🗑️</button>
        `;
        if (v.paradaActual === 'cochabamba') colCbba.appendChild(card);
        else if (v.paradaActual === 'eterazama') colEte.appendChild(card);
    });
}

async function eliminarVehiculoAdmin(id) {
    if (!confirm("¿Está seguro de eliminar este vehículo de la flota?")) return;
    try {
        await ApiService.eliminarVehiculo(id);
        await cargarFlota();
        renderizerTodoAdmin();
        showToast("Vehículo eliminado correctamente", "info");
    } catch (err) {
        showToast("Error eliminando vehículo", "error");
    }
}

async function guardarReordenamientoAdmin() {
    const inputs = document.querySelectorAll('#sub-panel-vehiculos .input-puesto-fila');
    const cambios = [];
    inputs.forEach(inp => {
        cambios.push({ id: parseInt(inp.getAttribute('data-id')), puestoFila: parseInt(inp.value) });
    });

    try {
        await ApiService.reordenarFila(cambios);
        await cargarFlota();
        renderizarAdminParadas();
        showToast("✔ Fila reordenada correctamente", "success");
    } catch (err) {
        showToast(err.message || "Error reordenando la fila", "error");
    }
}

function renderizarAdminBoleteriaVentanilla() {
    const colCbba = document.getElementById('lista-sec-cbba');
    const colEte = document.getElementById('lista-sec-ete');
    colCbba.innerHTML = ''; colEte.innerHTML = '';

    listadoFlotaGlobal.forEach(v => {
        if (v.paradaActual === 'fuera_de_fila') return;

        const card = document.createElement('div'); card.className = "admin-car-card selectable";
        card.onclick = () => abrirBoleteriaAdminPaso2(v);
        card.innerHTML = `<div><span class="car-position-badge">${v.puestoFila}°</span><b>${v.choferNombre}</b> [${v.placa}]</div><span style="color:var(--neon-blue); font-size:0.8rem;">Vender ➔</span>`;
        if (v.paradaActual === 'cochabamba') colCbba.appendChild(card);
        else if (v.paradaActual === 'eterazama') colEte.appendChild(card);
    });
}

function abrirBoleteriaAdminPaso2(v) {
    cocheSecSeleccionado = v; asientosSecElegidos = [];
    document.getElementById('sec-venta-paso1').style.display = 'none';
    document.getElementById('sec-venta-paso2').style.display = 'block';
    document.getElementById('lbl-sec-bus-titulo').innerText = `Despacho: ${v.choferNombre}`;

    const grid = document.getElementById('grid-asientos-sec'); grid.innerHTML = '';
    const ocupados = v.asientosOcupados || [];

    for (let i = 1; i <= 16; i++) {
        const s = document.createElement('div'); s.className = "seat"; s.innerText = i;
        if (ocupados.includes(i)) s.classList.add('occupied');
        else {
            s.addEventListener('click', () => {
                if (asientosSecElegidos.includes(i)) {
                    asientosSecElegidos = asientosSecElegidos.filter(x => x !== i);
                    s.classList.remove('selected');
                } else {
                    asientosSecElegidos.push(i);
                    s.classList.add('selected');
                }
                recalcularAdminVentanilla();
            });
        }
        grid.appendChild(s);
    }
    recalcularAdminVentanilla();
}

function recalcularAdminVentanilla() {
    if (!cocheSecSeleccionado) return;
    const precio = cocheSecSeleccionado.paradaActual === 'cochabamba' ? 15 : 18;
    const total = asientosSecElegidos.length * precio;
    document.getElementById('lbl-asientos-sec-txt').innerText = asientosSecElegidos.join(', ') || "Ninguno";
    document.getElementById('lbl-cobro-sec-txt').innerText = total.toFixed(2) + " Bs";
    document.getElementById('btn-emitir-sec').disabled = asientosSecElegidos.length === 0;
}

async function completarVentaVentanilla() {
    const cliente = document.getElementById('txt-cliente-sec').value;
    if (!cliente) return showToast("Ingrese el nombre del pasajero", "warning");

    const precio = cocheSecSeleccionado.paradaActual === 'cochabamba' ? 15 : 18;
    const total = asientosSecElegidos.length * precio;

    try {
        const res = await ApiService.registrarVenta({
            vehiculoId: cocheSecSeleccionado.id,
            pasajeroNombre: cliente,
            placaVehiculo: cocheSecSeleccionado.placa,
            asientos: asientosSecElegidos,
            montoAsientos: total,
            montoEncomienda: 0,
            tramo: cocheSecSeleccionado.paradaActual === 'cochabamba' ? 'Cochabamba ➔ Eterazama' : 'Eterazama ➔ Cochabamba'
        });

        await ApiService.trasladarVehiculo(cocheSecSeleccionado.id, 'en_ruta');
        await cargarFlota();
        cancelarBoleteriaAdmin();
        renderizerTodoAdmin();
        showToast("✔ Pasaje emitido y vehículo enviado a ruta", "success");
    } catch (err) {
        showToast(err.message || "Error al emitir el pasaje", "error");
    }
}

function cancelarBoleteriaAdmin() {
    cocheSecSeleccionado = null;
    document.getElementById('sec-venta-paso2').style.display = 'none';
    document.getElementById('sec-venta-paso1').style.display = 'block';
    renderizarAdminBoleteriaVentanilla();
}

function renderizarAdminRuta() {
    const ida = document.getElementById('lista-ruta-ida');
    const vuelta = document.getElementById('lista-ruta-vuelta');
    ida.innerHTML = ''; vuelta.innerHTML = '';

    const enRuta = listadoFlotaGlobal.filter(v => v.paradaActual === 'en_ruta');
    enRuta.forEach(v => {
        const card = document.createElement('div'); card.className = "admin-car-card";
        card.innerHTML = `<div><b>${v.choferNombre}</b> [${v.placa}]</div><button class="btn-touch-action btn-green" style="padding:5px 10px; font-size:0.75rem; width:auto;" onclick="llegadaRutaAdmin(${v.id}, 'eterazama')">🏁 Llegó a Ete</button>`;
        ida.appendChild(card);
    });
}

async function llegadaRutaAdmin(id, destino) {
    try {
        await ApiService.trasladarVehiculo(id, destino);
        await cargarFlota();
        renderizerTodoAdmin();
        showToast("Vehículo asignado a la nueva parada", "info");
    } catch (err) {
        showToast("Error al marcar la llegada del vehículo", "error");
    }
}

// NÓMINA CONDUCTORES DIRECTO DESDE FLOTA
async function renderizarNominaConductores() {
    const cont = document.getElementById('contenedor-nombres-choferes');
    if (!cont) return;
    cont.innerHTML = '';

    try {
        // Aseguramos cargar la flota global actualizada
        await cargarFlota();

        if (!Array.isArray(listadoFlotaGlobal) || listadoFlotaGlobal.length === 0) {
            cont.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">No hay choferes registrados en el sistema.</p>`;
            return;
        }

        listadoFlotaGlobal.forEach(ch => {
            const row = document.createElement('div');
            row.className = "fila-chofer-name";
            row.style.cursor = 'pointer';
            row.style.padding = '12px';
            row.style.background = 'rgba(255,255,255,0.03)';
            row.style.marginBottom = '6px';
            row.style.borderRadius = '8px';
            row.style.border = '1px solid var(--border-glass)';
            row.innerHTML = `
                <div>
                    <b>👤 ${ch.choferNombre}</b>
                    <small style="display:block; color:var(--text-muted); font-size:0.75rem;">Placa: ${ch.placa} | C.I.: ${ch.choferCi || 'S/N'}</small>
                </div>
                <span style="color:var(--neon-blue); font-size:0.8rem; font-weight:bold;">Ver / Editar ✏️</span>
            `;
            row.onclick = () => seleccionarChoferParaEditar(ch);
            cont.appendChild(row);
        });
    } catch (err) {
        console.warn("No se pudo cargar la nómina de choferes:", err);
        cont.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">Sin choferes registrados.</p>`;
    }
}

function seleccionarChoferParaEditar(ch) {
    choferSeleccionadoEdicion = ch;
    document.getElementById('edit-ch-nombre').value = ch.choferNombre || '';
    document.getElementById('edit-ch-apellidos').value = '';
    document.getElementById('edit-ch-gmail').value = '';
    document.getElementById('edit-ch-telefono').value = '';
    document.getElementById('edit-ch-placa').value = ch.placa || '';

    const qrBox = document.getElementById('box-qr-chofer-preview');
    if (ch.qrImagenUrl) {
        qrBox.innerHTML = `<img src="${ch.qrImagenUrl}" alt="QR Chofer">`;
    } else {
        qrBox.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">Sin QR cargado</span>`;
    }

    document.getElementById('panel-ficha-chofer').style.display = 'block';
}

async function guardarEdicionChofer() {
    if (!choferSeleccionadoEdicion) return;

    const nom = document.getElementById('edit-ch-nombre').value.trim();
    const plc = document.getElementById('edit-ch-placa').value.trim();

    try {
        await ApiService.crearVehiculo({
            choferNombre: nom,
            placa: plc,
            tipoVehiculo: choferSeleccionadoEdicion.tipoVehiculo || 'Minibus',
            color: choferSeleccionadoEdicion.color || 'Blanco',
            choferCi: choferSeleccionadoEdicion.choferCi,
            qrImagenUrl: choferSeleccionadoEdicion.qrImagenUrl,
            paradaActual: choferSeleccionadoEdicion.paradaActual || 'fuera_de_fila'
        });

        showToast("✔ Información del chofer actualizada", "success");
        renderizarNominaConductores();
    } catch (err) {
        showToast(err.message || "Error al actualizar la información del chofer", "error");
    }
}

// --- LÓGICA DE RECORTAR IMAGEN QR (CROPPER.JS) ---
function iniciarProcesoRecorteQr(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const cropTarget = document.getElementById('img-crop-target');
        cropTarget.src = e.target.result;

        document.getElementById('modal-crop-qr').style.display = 'flex';

        if (cropperInstance) cropperInstance.destroy();

        cropperInstance = new Cropper(cropTarget, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 0.8,
        });
    };
    reader.readAsDataURL(file);
}

function aplicarRecorteQr() {
    if (!cropperInstance) return;

    const canvas = cropperInstance.getCroppedCanvas({
        width: 300,
        height: 300,
    });

    base64QrSeleccionado = canvas.toDataURL('image/jpeg', 0.85);

    const imgPreview = document.getElementById('img-qr-preview-create');
    const textPreview = document.getElementById('lbl-qr-preview-text');
    imgPreview.src = base64QrSeleccionado;
    imgPreview.style.display = 'block';
    textPreview.style.display = 'none';

    cancelarRecorteQr();
    showToast("✂️ Imagen recortada correctamente", "success");
}

function cancelarRecorteQr() {
    document.getElementById('modal-crop-qr').style.display = 'none';
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
}

async function guardarNuevoChoferAdmin() {
    const nom = document.getElementById('ch-nombre').value.trim();
    const ci = document.getElementById('ch-ci').value.trim();
    const tipo = document.getElementById('ch-tipo').value.trim();
    const col = document.getElementById('ch-color').value.trim();
    const plc = document.getElementById('ch-placa').value.trim();

    if (!nom || !plc) return showToast("Ingrese nombre y placa del vehículo", "warning");

    try {
        await ApiService.crearVehiculo({
            choferNombre: nom,
            choferCi: ci || null,
            qrImagenUrl: base64QrSeleccionado || null,
            tipoVehiculo: tipo || 'Minibus',
            color: col || 'Blanco',
            placa: plc,
            paradaActual: 'fuera_de_fila',
            puestoFila: 0
        });

        await cargarFlota();
        renderizerTodoAdmin();

        document.getElementById('ch-nombre').value = '';
        document.getElementById('ch-ci').value = '';
        document.getElementById('ch-tipo').value = '';
        document.getElementById('ch-color').value = '';
        document.getElementById('ch-placa').value = '';
        document.getElementById('ch-qr-file').value = '';
        document.getElementById('img-qr-preview-create').style.display = 'none';
        document.getElementById('lbl-qr-preview-text').style.display = 'block';
        base64QrSeleccionado = null;

        showToast("✔ Conductor y código QR guardados exitosamente", "success");
    } catch (err) {
        showToast(err.message || "Error al crear el vehículo", "error");
    }
}

// BUSCADOR EN TIEMPO REAL CON SUGERENCIAS
function alEscribirBuscadorRecuperacion(e) {
    const val = e.target.value.trim();
    const box = document.getElementById('box-sugerencias-recuperar');

    if (!val) {
        box.style.display = 'none';
        document.getElementById('panel-resultado-recuperacion').style.display = 'none';
        return;
    }

    clearTimeout(debounceTimerSearch);
    debounceTimerSearch = setTimeout(async () => {
        try {
            const sugerencias = await ApiService.buscarUsuarioCriterio(val);
            box.innerHTML = '';

            if (sugerencias.length === 0) {
                box.innerHTML = `<div class="suggest-item" style="color:var(--text-muted);">Sin resultados para "${val}"</div>`;
            } else {
                sugerencias.forEach(u => {
                    const item = document.createElement('div');
                    item.className = 'suggest-item';
                    item.innerHTML = `
                        <div>
                            <b>${u.nombreUsuario}</b>
                            <small style="display:block; color:var(--text-muted);">${u.nombre || ''} ${u.apellidos || ''} ${u.gmail ? '| ' + u.gmail : ''}</small>
                        </div>
                        <span style="color:var(--neon-cyan); font-size:0.75rem; text-transform:uppercase;">${u.rol}</span>
                    `;
                    item.onclick = () => seleccionarUsuarioRecuperacion(u);
                    box.appendChild(item);
                });
            }
            box.style.display = 'block';
        } catch (err) {
            box.style.display = 'none';
        }
    }, 250);
}

function seleccionarUsuarioRecuperacion(u) {
    usuarioEncontradoRecuperacion = u;
    document.getElementById('box-sugerencias-recuperar').style.display = 'none';
    document.getElementById('txt-busqueda-recuperar').value = u.nombreUsuario;

    document.getElementById('rec-nombre').innerText = `${u.nombre || ''} ${u.apellidos || ''}`.trim() || 'Sin Nombre Registrado';
    document.getElementById('rec-user').innerText = u.nombreUsuario;
    document.getElementById('rec-gmail').innerText = u.gmail || 'No registrado';
    document.getElementById('rec-telefono').innerText = u.telefono || 'No registrado';
    document.getElementById('rec-rol-actual').innerText = (u.rol || 'pasajero').toUpperCase();
    document.getElementById('txt-nueva-pass-rec').value = '';

    document.getElementById('panel-resultado-recuperacion').style.display = 'block';
}

async function confirmarRestablecerPassword() {
    if (!usuarioEncontradoRecuperacion) return;
    const nuevaPass = document.getElementById('txt-nueva-pass-rec').value;
    if (!nuevaPass) return showToast("Escriba la nueva contraseña", "warning");

    try {
        await ApiService.restablecerPassword(usuarioEncontradoRecuperacion.id, nuevaPass);
        showToast("✔ Contraseña actualizada exitosamente", "success");
        document.getElementById('panel-resultado-recuperacion').style.display = 'none';
        document.getElementById('txt-busqueda-recuperar').value = '';
    } catch (err) {
        showToast(err.message || "Error al restablecer contraseña", "error");
    }
}

async function obtenerCajaCentralAPI() {
    try {
        const data = await ApiService.obtenerCajaCentral();
        document.getElementById('lbl-caja-global').innerText = Number(data.montoTotalCaja).toFixed(2) + " Bs";
    } catch (err) {}
}

async function obtenerHistorialAPI() {
    try {
        const lista = await ApiService.obtenerHistorial();
        const body = document.getElementById('tabla-historial-cuerpo'); body.innerHTML = '';
        lista.forEach(h => {
            body.innerHTML += `
                <tr>
                    <td><b>${h.placaVehiculo}</b></td>
                    <td>${h.pasajeroNombre}</td>
                    <td>${h.tramo}</td>
                    <td><small>${new Date(h.fechaCreacion).toLocaleDateString()}</small></td>
                    <td style="color:var(--neon-green); font-weight:bold;">${Number(h.montoTotal).toFixed(2)} Bs</td>
                    <td><button class="btn-touch-action btn-blue" style="padding:4px 8px; font-size:0.75rem; width:auto;" onclick="ApiService.descargarPdfComprobante('${h.id}')">📄 PDF</button></td>
                </tr>
            `;
        });
    } catch (err) {}
}

function renderizerTodoAdmin() {
    renderizarAdminParadas();
    renderizarAdminBoleteriaVentanilla();
    renderizarAdminRuta();
    renderizarNominaConductores();
    obtenerCajaCentralAPI();
    obtenerHistorialAPI();
}