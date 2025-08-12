import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, getDoc, setDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA5RTAhwU-HlvMl_B2jmzNvrYRefOjGqrs",
    authDomain: "flor-ee15d.firebaseapp.com",
    projectId: "flor-ee15d",
    storageBucket: "flor-ee15d.firebasestorage.app",
    messagingSenderId: "814685471419",
    appId: "1:814685471419:web:0d2ffe96939349fbe6df9e",
    measurementId: "G-NJ427BC4ZT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let estadosSalones = [
    {
        mesas: [],
        invitadosPendientes: [],
        ancho: 20,
        alto: 10
    },
    {
        mesas: [],
        invitadosPendientes: [],
        ancho: 20,
        alto: 10
    },
    {
        mesas: [],
        invitadosPendientes: [],
        ancho: 20,
        alto: 10
    }
];

let salonActual = 1;
const PIXELS_POR_METRO = 50;
let mesaArrastrando = null;
let invitadoArrastrandoData = null;
let eventId = null;

const anchoMesaInput = document.getElementById('ancho_mesa');
const altoMesaInput = document.getElementById('alto_mesa');
const capacidadMesaInput = document.getElementById('capacidad_mesa');

function crearSalon(salonId = salonActual) {
    const estado = estadosSalones[salonId - 1];
    
    let anchoEnMetros = parseFloat(document.getElementById('ancho_salon').value) || estado.ancho;
    let altoEnMetros = parseFloat(document.getElementById('alto_salon').value) || estado.alto;
    
    estado.ancho = anchoEnMetros;
    estado.alto = altoEnMetros;

    const anchoEnPixeles = anchoEnMetros * PIXELS_POR_METRO;
    const altoEnPixeles = altoEnMetros * PIXELS_POR_METRO;

    const salonDiv = document.getElementById(`salon-${salonId}`);
    if (!salonDiv) return;
    
    salonDiv.style.width = `${anchoEnPixeles}px`;
    salonDiv.style.height = `${altoEnPixeles}px`;

    salonDiv.innerHTML = '';
    estado.mesas.forEach(crearMesaEnDOM);
}

function cambiarSalon(nuevoSalonId) {
    if (nuevoSalonId === salonActual) return;

    const salonAnteriorDiv = document.getElementById(`salon-${salonActual}`);
    salonAnteriorDiv.classList.add('hidden');
    const botonAnterior = document.getElementById(`tab-salon-${salonActual}`);
    if (botonAnterior) botonAnterior.classList.remove('active');

    salonActual = nuevoSalonId;

    const salonNuevoDiv = document.getElementById(`salon-${salonActual}`);
    salonNuevoDiv.classList.remove('hidden');
    const botonNuevo = document.getElementById(`tab-salon-${salonActual}`);
    if (botonNuevo) botonNuevo.classList.add('active');

    const estado = estadosSalones[salonActual - 1];
    document.getElementById('ancho_salon').value = estado.ancho;
    document.getElementById('alto_salon').value = estado.alto;

    const anchoEnPixeles = estado.ancho * PIXELS_POR_METRO;
    const altoEnPixeles = estado.alto * PIXELS_POR_METRO;

    salonNuevoDiv.style.width = `${anchoEnPixeles}px`;
    salonNuevoDiv.style.height = `${altoEnPixeles}px`;

    salonNuevoDiv.innerHTML = '';
    estado.mesas.forEach(crearMesaEnDOM);

    renderizarListaPendientes();
}

function renderizarListaPendientes() {
    const estado = estadosSalones[salonActual - 1];
    const listaPendientesUl = document.getElementById('lista-invitados-pendientes');
    if (!listaPendientesUl) return;

    listaPendientesUl.innerHTML = '';
    estado.invitadosPendientes.forEach(invitado => {
        const li = document.createElement('li');
        li.textContent = `${invitado.apellido}, ${invitado.nombre}`;
        li.draggable = true;
        li.dataset.invitado = JSON.stringify(invitado);
        li.addEventListener('dragstart', iniciarArrastreInvitado);
        listaPendientesUl.appendChild(li);
    });
}

async function guardarPlanoEnFirebase() {
    if (!eventId) return;
    const docRef = doc(db, 'seating_charts', eventId);
    await setDoc(docRef, { estadosSalones });
}

async function cargarPlanoDeFirebase() {
    if (!eventId) return;
    const docRef = doc(db, 'seating_charts', eventId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        estadosSalones = data.estadosSalones;
        document.getElementById('ancho_salon').value = estadosSalones[0].ancho;
        document.getElementById('alto_salon').value = estadosSalones[0].alto;
        crearSalon(1);
    } else {
        console.log("No hay datos de plano para este evento. Se carga el estado por defecto.");
    }
    actualizarSalon();
}

function actualizarSalon() {
    crearSalon(salonActual);
    renderizarListaPendientes();
    guardarPlanoEnFirebase();
}

function agregarMesa(tipo) {
    const estado = estadosSalones[salonActual - 1];

    const nombreMesa = document.getElementById('nombre_mesa').value.trim();
    let anchoEnMetros = parseFloat(anchoMesaInput.value) || (tipo === 'cuadrada' ? 0.8 : tipo === 'redonda' ? 1.8 : 2.45);
    let altoEnMetros = parseFloat(altoMesaInput.value) || (tipo === 'cuadrada' ? 0.8 : tipo === 'redonda' ? 1.8 : 1.1);
    let capacidad = parseInt(capacidadMesaInput.value, 10);
    
    if (isNaN(capacidad) || capacidad <= 0) {
        capacidad = (tipo === 'rectangular') ? 12 : 8;
    }

    if (tipo === 'redonda') {
        altoEnMetros = anchoEnMetros;
    }
    
    const anchoEnPixeles = anchoEnMetros * PIXELS_POR_METRO;
    const altoEnPixeles = altoEnMetros * PIXELS_POR_METRO;

    const idMesa = `mesa-${Date.now()}`;
    const invitados = Array(capacidad).fill(null);

    const mesaData = {
        id: idMesa,
        nombre: nombreMesa,
        tipo: tipo,
        ancho: `${anchoEnPixeles}px`,
        alto: `${altoEnPixeles}px`,
        posicion: { top: '10px', left: '10px' },
        capacidad: capacidad,
        invitados: invitados,
        rotacion: 0
    };

    estado.mesas.push(mesaData);
    crearMesaEnDOM(mesaData);
    guardarPlanoEnFirebase();

    document.getElementById('nombre_mesa').value = '';
    anchoMesaInput.value = '';
    altoMesaInput.value = '';
    capacidadMesaInput.value = '';
}

function crearMesaEnDOM(mesaData) {
    const salonDiv = document.getElementById(`salon-${salonActual}`);
    if (!salonDiv) return;
    
    const mesaDiv = document.createElement('div');
    mesaDiv.classList.add('mesa', mesaData.tipo);
    mesaDiv.dataset.nombre = mesaData.nombre;
    mesaDiv.id = mesaData.id;
    mesaDiv.style.top = mesaData.posicion.top;
    mesaDiv.style.left = mesaData.posicion.left;
    mesaDiv.style.width = mesaData.ancho;
    mesaDiv.style.height = mesaData.alto;
    mesaDiv.style.transform = `rotate(${mesaData.rotacion}deg)`;
    
    if (mesaData.tipo === 'redonda') {
        mesaDiv.style.borderRadius = '50%';
    }
    
    mesaDiv.addEventListener('mousedown', iniciarArrastreMesa);
    mesaDiv.addEventListener('dragover', e => e.preventDefault());
    mesaDiv.addEventListener('drop', e => soltarInvitado(e, mesaDiv.id));

    mesaDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const estado = estadosSalones[salonActual - 1];
        const mesa = estado.mesas.find(m => m.id === mesaDiv.id);
        if (!mesa) return;

        if (e.altKey) {
            if (mesa.tipo === 'cuadrada' || mesa.tipo === 'rectangular') {
                mesa.rotacion = (mesa.rotacion + 15) % 360;
                mesaDiv.style.transform = `rotate(${mesa.rotacion}deg)`;
                posicionarSillas(mesaDiv, mesa.tipo, mesa.capacidad, mesa.rotacion);
                guardarPlanoEnFirebase();
            }
        } else { 
            if (confirm(`¿Estás seguro de que quieres eliminar la mesa "${mesa.nombre || 'sin nombre'}"?`)) {
                const index = estado.mesas.findIndex(m => m.id === mesa.id);
                if (index > -1) {
                    mesa.invitados.forEach(invitado => {
                        if (invitado) {
                            estado.invitadosPendientes.push(invitado);
                        }
                    });
                    estado.mesas.splice(index, 1);
                    mesaDiv.remove();
                    actualizarSalon();
                }
            }
        }
    });
    
    const nombreMesaSpan = document.createElement('span');
    nombreMesaSpan.classList.add('nombre-mesa');
    nombreMesaSpan.textContent = mesaData.nombre;
    mesaDiv.appendChild(nombreMesaSpan);

    const sillasContenedor = document.createElement('div');
    sillasContenedor.classList.add('mesa-sillas-contenedor');

    for (let i = 0; i < mesaData.capacidad; i++) {
        const silla = document.createElement('div');
        silla.classList.add('silla');
        silla.dataset.sillaIndex = i;
        if (mesaData.invitados[i]) {
            silla.classList.add('ocupada', 'texto-negro');
            silla.textContent = mesaData.invitados[i].apellido;
        }
        silla.addEventListener('dragover', e => e.preventDefault());
        silla.addEventListener('drop', e => soltarInvitadoEnSilla(e, mesaData.id, i));
        sillasContenedor.appendChild(silla);
    }
    mesaDiv.appendChild(sillasContenedor);
    salonDiv.appendChild(mesaDiv);
    posicionarSillas(mesaDiv, mesaData.tipo, mesaData.capacidad, mesaData.rotacion);
    actualizarVisibilidadApellidos();
}

function posicionarSillas(mesaDiv, tipo, capacidad, rotacion = 0) {
    const sillas = mesaDiv.querySelectorAll('.silla');
    const mesaAncho = mesaDiv.offsetWidth;
    const mesaAlto = mesaDiv.offsetHeight;
    
    if (tipo === 'redonda') {
        const radio = Math.min(mesaAncho, mesaAlto) / 2;
        const radioExterior = radio + 20;
        sillas.forEach((silla, i) => {
            const angulo = (360 / capacidad) * i;
            const rad = (angulo - 90) * Math.PI / 180;
            const x = radio + radioExterior * Math.cos(rad);
            const y = radio + radioExterior * Math.sin(rad);
            silla.style.top = `${y - silla.offsetHeight / 2}px`;
            silla.style.left = `${x - silla.offsetWidth / 2}px`;
            silla.style.transform = `rotate(0deg)`;
        });
    } else {
        const perimetro = mesaAncho * 2 + mesaAlto * 2;
        let sillasPorLado = [
            Math.round(capacidad * (mesaAncho / perimetro)),
            Math.round(capacidad * (mesaAlto / perimetro)),
            Math.round(capacidad * (mesaAncho / perimetro)),
            Math.round(capacidad * (mesaAlto / perimetro))
        ];
        
        let totalSillas = sillasPorLado.reduce((a, b) => a + b, 0);
        while (totalSillas > capacidad) {
            sillasPorLado[sillasPorLado.indexOf(Math.max(...sillasPorLado))]--;
            totalSillas--;
        }
        while (totalSillas < capacidad) {
            sillasPorLado[sillasPorLado.indexOf(Math.min(...sillasPorLado))]++;
            totalSillas++;
        }

        let sillaIndex = 0;
        const margenVertical = 25;
        const margenHorizontal = 25;

        // Lado Superior
        for (let i = 0; i < sillasPorLado[0]; i++) {
            if (sillaIndex >= sillas.length) break;
            const silla = sillas[sillaIndex];
            silla.style.left = `${(mesaAncho / (sillasPorLado[0] + 1)) * (i + 1) - silla.offsetWidth / 2}px`;
            silla.style.top = `${-margenVertical}px`;
            silla.style.transform = `rotate(-90deg)`;
            sillaIndex++;
        }
        // Lado Derecho
        for (let i = 0; i < sillasPorLado[1]; i++) {
            if (sillaIndex >= sillas.length) break;
            const silla = sillas[sillaIndex];
            silla.style.left = `${mesaAncho + margenHorizontal - silla.offsetWidth / 2}px`;
            silla.style.top = `${(mesaAlto / (sillasPorLado[1] + 1)) * (i + 1) - silla.offsetHeight / 2}px`;
            silla.style.transform = `rotate(0deg)`;
            sillaIndex++;
        }
        // Lado Inferior
        for (let i = 0; i < sillasPorLado[2]; i++) {
            if (sillaIndex >= sillas.length) break;
            const silla = sillas[sillaIndex];
            silla.style.left = `${mesaAncho - (mesaAncho / (sillasPorLado[2] + 1)) * (i + 1) - silla.offsetWidth / 2}px`;
            silla.style.top = `${mesaAlto + margenVertical}px`;
            silla.style.transform = `rotate(90deg)`;
            sillaIndex++;
        }
        // Lado Izquierdo
        for (let i = 0; i < sillasPorLado[3]; i++) {
            if (sillaIndex >= sillas.length) break;
            const silla = sillas[sillaIndex];
            silla.style.left = `${-margenHorizontal}px`;
            silla.style.top = `${(mesaAlto / (sillasPorLado[3] + 1)) * (i + 1) - silla.offsetHeight / 2}px`;
            silla.style.transform = `rotate(0deg)`;
            sillaIndex++;
        }
    }
}

function iniciarArrastreMesa(e) {
    if (e.target.classList.contains('silla')) return;
    mesaArrastrando = this;
    mesaArrastrando.style.cursor = 'grabbing';
    let offsetX = e.clientX - mesaArrastrando.getBoundingClientRect().left;
    let offsetY = e.clientY - mesaArrastrando.getBoundingClientRect().top;
    const salonDiv = document.getElementById(`salon-${salonActual}`);

    function moverMesa(e) {
        if (!mesaArrastrando) return;
        let x = e.clientX - offsetX - salonDiv.getBoundingClientRect().left;
        let y = e.clientY - offsetY - salonDiv.getBoundingClientRect().top;

        x = Math.max(0, Math.min(x, salonDiv.clientWidth - mesaArrastrando.clientWidth));
        y = Math.max(0, Math.min(y, salonDiv.clientHeight - mesaArrastrando.clientHeight));

        mesaArrastrando.style.left = `${x}px`;
        mesaArrastrando.style.top = `${y}px`;
        
        const estado = estadosSalones[salonActual - 1];
        const mesaData = estado.mesas.find(m => m.id === mesaArrastrando.id);
        if (mesaData) {
            mesaData.posicion = { top: mesaArrastrando.style.top, left: mesaArrastrando.style.left };
        }
    }

    function terminarArrastre() {
        if (mesaArrastrando) {
            mesaArrastrando.style.cursor = 'grab';
            guardarPlanoEnFirebase();
        }
        mesaArrastrando = null;
        document.removeEventListener('mousemove', moverMesa);
        document.removeEventListener('mouseup', terminarArrastre);
    }

    document.addEventListener('mousemove', moverMesa);
    document.addEventListener('mouseup', terminarArrastre);
}

function importarInvitados() {
    const estado = estadosSalones[salonActual - 1];
    const listaRaw = document.getElementById('lista_invitados').value.trim();
    if (!listaRaw) return;

    const lineas = listaRaw.split('\n');
    lineas.forEach(linea => {
        const partes = linea.trim().split(/\s+/);
        if (partes.length >= 2) {
            const invitado = { 
                apellido: partes[0], 
                nombre: partes[1], 
                ubicacion: partes.length > 2 ? partes.slice(2).join('_') : '' 
            };
            estado.invitadosPendientes.push(invitado);
        }
    });
    
    document.getElementById('lista_invitados').value = '';
    actualizarSalon();
}

function asignarAutomaticamente() {
    const estado = estadosSalones[salonActual - 1];
    
    estado.mesas.forEach(mesa => {
        mesa.invitados.forEach(invitado => {
            if (invitado) estado.invitadosPendientes.push(invitado);
        });
        mesa.invitados.fill(null);
    });

    const invitadosNoAsignados = [];
    estado.invitadosPendientes.forEach(invitado => {
        const mesaDeseada = estado.mesas.find(m => m.nombre.toLowerCase() === invitado.ubicacion.toLowerCase());
        if (mesaDeseada) {
            const sillaLibreIdx = mesaDeseada.invitados.indexOf(null);
            if (sillaLibreIdx !== -1) {
                mesaDeseada.invitados[sillaLibreIdx] = invitado;
            } else {
                invitadosNoAsignados.push(invitado);
            }
        } else {
            invitadosNoAsignados.push(invitado);
        }
    });

    invitadosNoAsignados.forEach(invitado => {
        const mesaConLugar = estado.mesas.find(m => m.invitados.includes(null));
        if (mesaConLugar) {
            const sillaLibreIdx = mesaConLugar.invitados.indexOf(null);
            mesaConLugar.invitados[sillaLibreIdx] = invitado;
        }
    });

    estado.invitadosPendientes = invitadosNoAsignados.filter(inv => !estado.mesas.some(m => m.invitados.includes(inv)));
    
    actualizarSalon();
}

function iniciarArrastreInvitado(e) {
    const invitadoData = this.dataset.invitado;
    if (invitadoData) {
        e.dataTransfer.setData('text/plain', invitadoData);
        this.classList.add('invitado-arrastrando');
    }
}

function soltarInvitado(e, idMesaDestino) {
    e.preventDefault();
    const invitadoData = e.dataTransfer.getData('text/plain');
    if (!invitadoData) return;
    
    let invitado = null;
    try {
        invitado = JSON.parse(invitadoData);
    } catch (error) {
        console.error("Error al parsear JSON:", error);
        return;
    }
    if (!invitado) return;

    const estado = estadosSalones[salonActual - 1];
    const mesaDestino = estado.mesas.find(m => m.id === idMesaDestino);
    if (!mesaDestino) return;
    
    const sillaLibreIdx = mesaDestino.invitados.indexOf(null);
    if (sillaLibreIdx !== -1) {
        soltarInvitadoEnSilla(e, idMesaDestino, sillaLibreIdx);
    } else {
        alert('Esta mesa está llena.');
    }
}

function soltarInvitadoEnSilla(e, idMesa, sillaIndex) {
    e.preventDefault();
    e.stopPropagation();
    const invitadoData = e.dataTransfer.getData('text/plain');
    if (!invitadoData) return;

    let invitado = null;
    try {
        invitado = JSON.parse(invitadoData);
    } catch (error) {
        console.error("Error al parsear JSON:", error);
        return;
    }
    if (!invitado) return;

    const estado = estadosSalones[salonActual - 1];

    estado.mesas.forEach(m => {
        const idx = m.invitados.findIndex(i => i && i.apellido === invitado.apellido && i.nombre === invitado.nombre);
        if (idx !== -1) m.invitados[idx] = null;
    });
    estado.invitadosPendientes = estado.invitadosPendientes.filter(i => !(i.apellido === invitado.apellido && i.nombre === invitado.nombre));

    const mesaDestino = estado.mesas.find(m => m.id === idMesa);
    if(mesaDestino.invitados[sillaIndex]) {
        estado.invitadosPendientes.push(mesaDestino.invitados[sillaIndex]);
    }
    mesaDestino.invitados[sillaIndex] = invitado;
    
    actualizarSalon();
}

function actualizarVisibilidadApellidos() {
    const mostrarApellidos = document.getElementById('mostrar_apellidos_checkbox').checked;
    document.querySelectorAll('.silla').forEach(silla => {
        if (silla.classList.contains('ocupada')) {
            silla.style.visibility = mostrarApellidos ? 'visible' : 'hidden';
        }
    });
}

function descargarPlano() {
    const salonDiv = document.getElementById(`salon-${salonActual}`);
    const nombreSalon = `Plano-Salon-${salonActual}`;

    html2canvas(salonDiv, {
        scale: 2, 
        backgroundColor: '#ffffff'
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `${nombreSalon}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

window.onload = function() {
    eventId = getQueryParam('id');
    if (eventId) {
        cargarPlanoDeFirebase();
    } else {
        document.getElementById('ancho_salon').value = estadosSalones[0].ancho;
        document.getElementById('alto_salon').value = estadosSalones[0].alto;
        crearSalon(1);
    }

    document.getElementById('btn-crear-salon').addEventListener('click', () => {
        crearSalon(salonActual);
        guardarPlanoEnFirebase();
    });
    
    document.getElementById('btn-agregar-cuadrada').addEventListener('click', () => agregarMesa('cuadrada'));
    document.getElementById('btn-agregar-redonda').addEventListener('click', () => agregarMesa('redonda'));
    document.getElementById('btn-agregar-rectangular').addEventListener('click', () => agregarMesa('rectangular'));
    
    document.getElementById('btn-importar-invitados').addEventListener('click', importarInvitados);
    document.getElementById('btn-asignar-auto').addEventListener('click', asignarAutomaticamente);

    document.getElementById('descargar-plano-btn').addEventListener('click', descargarPlano);
    document.getElementById('mostrar_apellidos_checkbox').addEventListener('change', actualizarVisibilidadApellidos);

    document.getElementById('tab-salon-1').addEventListener('click', () => {
        cambiarSalon(1);
        guardarPlanoEnFirebase();
    });
    document.getElementById('tab-salon-2').addEventListener('click', () => {
        cambiarSalon(2);
        guardarPlanoEnFirebase();
    });
    document.getElementById('tab-salon-3').addEventListener('click', () => {
        cambiarSalon(3);
        guardarPlanoEnFirebase();
    });

    const listaPendientes = document.getElementById('invitados-pendientes-contenedor');
    listaPendientes.addEventListener('dragover', e => e.preventDefault());
    listaPendientes.addEventListener('drop', e => {
        e.preventDefault();
        const invitadoData = e.dataTransfer.getData('text/plain');
        if (!invitadoData) return;
        
        let invitado = null;
        try {
            invitado = JSON.parse(invitadoData);
        } catch (error) {
            console.error("Error al parsear JSON:", error);
            return;
        }
        if (!invitado) return;

        const estado = estadosSalones[salonActual - 1];

        estado.mesas.forEach(m => {
            const idx = m.invitados.findIndex(i => i && i.apellido === invitado.apellido && i.nombre === invitado.nombre);
            if (idx !== -1) m.invitados[idx] = null;
        });

        const yaExiste = estado.invitadosPendientes.some(i => i.apellido === invitado.apellido && i.nombre === invitado.nombre);
        if (!yaExiste) {
            estado.invitadosPendientes.push(invitado);
        }

        actualizarSalon();
    });
    
    window.addEventListener('resize', () => {
        crearSalon(salonActual);
        guardarPlanoEnFirebase();
    });
};