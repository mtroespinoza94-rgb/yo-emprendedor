// ============================================================
// app-negocio.js — Catálogo, clientes, ventas, cobros y reportes.
// Depende de app.js (necesita que "db", "auth" y "window.sesion"
// ya existan). Todo lo que se guarda aquí vive siempre dentro de
// usuarios/{uid}/... — nunca se mezcla con los datos de otro usuario,
// eso lo garantizan las reglas de seguridad de Firestore, no este
// archivo (nunca hay que confiar solo en el código del navegador).
// ============================================================

let productos = [];   // cache en memoria de usuarios/{uid}/productos
let clientes = [];    // cache en memoria de usuarios/{uid}/clientes
let ventas = [];      // cache en memoria de usuarios/{uid}/ventas
let carritoVenta = []; // items que se van armando antes de guardar una venta

function coleccion(nombre) {
  return db.collection('usuarios').doc(window.sesion.uid).collection(nombre);
}

function formatoMoneda(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatoFecha(timestamp) {
  if (!timestamp) return '—';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString('es-MX');
}

// ---------------- Navegación por pestañas ----------------
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('activo'));
  btn.classList.add('activo');
  document.querySelectorAll('section.panel').forEach(p => p.classList.remove('activo'));
  document.getElementById('panel-' + btn.dataset.tab).classList.add('activo');
});

// ============================================================
// CATÁLOGO
// ============================================================

document.getElementById('btn-guardar-producto').addEventListener('click', async () => {
  const nombre = document.getElementById('prod-nombre').value.trim();
  const categoria = document.getElementById('prod-categoria').value.trim() || 'Sin categoría';
  const precioVenta = parseFloat(document.getElementById('prod-precio').value);
  const costo = parseFloat(document.getElementById('prod-costo').value);
  const stock = parseInt(document.getElementById('prod-stock').value, 10);

  if (!nombre || isNaN(precioVenta) || precioVenta < 0) {
    mostrarMensaje('Ponele un nombre y un precio de venta válido al producto.', true);
    return;
  }

  try {
    await coleccion('productos').add({
      nombre,
      categoria,
      precioVenta,
      costo: isNaN(costo) ? 0 : costo,
      stock: isNaN(stock) ? 0 : stock,
      fechaIngreso: firebase.firestore.FieldValue.serverTimestamp(),
      activo: true
    });
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-categoria').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-costo').value = '';
    document.getElementById('prod-stock').value = '';
    mostrarMensaje('Producto guardado.');
    await cargarProductos();
  } catch (err) {
    mostrarMensaje('No se pudo guardar el producto: ' + err.message, true);
  }
});

async function cargarProductos() {
  const snap = await coleccion('productos').orderBy('categoria').get();
  productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderCatalogo();
  renderSelectExportCategoria();
  renderSelectVentaProducto();
}

function renderCatalogo() {
  const cont = document.getElementById('lista-catalogo');
  if (!productos.length) {
    cont.innerHTML = '<p class="vacio">Todavía no agregaste productos.</p>';
    return;
  }
  const porCategoria = {};
  productos.forEach(p => {
    (porCategoria[p.categoria] = porCategoria[p.categoria] || []).push(p);
  });
  cont.innerHTML = Object.keys(porCategoria).sort().map(cat => `
    <div class="grupo-categoria">
      <h3>${escaparHtml(cat)}</h3>
      <table>
        <thead><tr><th>Producto</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Ingresó</th></tr></thead>
        <tbody>
          ${porCategoria[cat].map(p => `
            <tr>
              <td>${escaparHtml(p.nombre)}</td>
              <td>${formatoMoneda(p.precioVenta)}</td>
              <td>${formatoMoneda(p.costo)}</td>
              <td>${p.stock}</td>
              <td>${formatoFecha(p.fechaIngreso)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

function renderSelectExportCategoria() {
  const sel = document.getElementById('export-categoria');
  const categorias = [...new Set(productos.map(p => p.categoria))].sort();
  sel.innerHTML = categorias.map(c => `<option value="${escaparAtributo(c)}">${escaparHtml(c)}</option>`).join('')
    || '<option value="">Agregá productos primero</option>';
}

document.getElementById('btn-generar-export').addEventListener('click', () => {
  const cat = document.getElementById('export-categoria').value;
  // Decisión de diseño ya avisada: la lista para ofrecer NUNCA incluye el
  // costo, solo nombre y precio de venta — es lo que se comparte con un
  // cliente, no es información interna del negocio.
  const items = productos.filter(p => p.categoria === cat);
  const texto = `Catálogo — ${cat}\n\n` + items.map(p => `• ${p.nombre} — ${formatoMoneda(p.precioVenta)}`).join('\n');
  const area = document.getElementById('export-resultado');
  area.value = items.length ? texto : 'No hay productos en esta categoría.';
  area.style.display = 'block';
  document.getElementById('btn-copiar-export').style.display = 'inline-block';
});

document.getElementById('btn-copiar-export').addEventListener('click', async () => {
  const area = document.getElementById('export-resultado');
  try {
    await navigator.clipboard.writeText(area.value);
    mostrarMensaje('Lista copiada. Ya la podés pegar en WhatsApp o donde quieras.');
  } catch {
    area.select();
    mostrarMensaje('Seleccioná el texto y copialo con Ctrl+C / Cmd+C.');
  }
});

// ============================================================
// CLIENTES
// ============================================================

document.getElementById('btn-guardar-cliente').addEventListener('click', async () => {
  const nombre = document.getElementById('cli-nombre').value.trim();
  const telefono = document.getElementById('cli-telefono').value.trim();
  const notas = document.getElementById('cli-notas').value.trim();

  if (!nombre) {
    mostrarMensaje('Ponele un nombre al cliente.', true);
    return;
  }

  try {
    await coleccion('clientes').add({
      nombre, telefono, notas,
      fechaAlta: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById('cli-nombre').value = '';
    document.getElementById('cli-telefono').value = '';
    document.getElementById('cli-notas').value = '';
    mostrarMensaje('Cliente guardado.');
    await cargarClientes();
  } catch (err) {
    mostrarMensaje('No se pudo guardar el cliente: ' + err.message, true);
  }
});

async function cargarClientes() {
  const snap = await coleccion('clientes').orderBy('nombre').get();
  clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderClientes();
  renderSelectVentaCliente();
}

function renderClientes() {
  const cont = document.getElementById('lista-clientes');
  if (!clientes.length) {
    cont.innerHTML = '<p class="vacio">Todavía no agregaste clientes.</p>';
    return;
  }
  cont.innerHTML = `
    <table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Notas</th><th>Desde</th></tr></thead>
      <tbody>
        ${clientes.map(c => `
          <tr>
            <td>${escaparHtml(c.nombre)}</td>
            <td>${escaparHtml(c.telefono || '—')}</td>
            <td>${escaparHtml(c.notas || '—')}</td>
            <td>${formatoFecha(c.fechaAlta)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ============================================================
// VENTAS
// ============================================================

function renderSelectVentaCliente() {
  const sel = document.getElementById('venta-cliente');
  sel.innerHTML = clientes.map(c => `<option value="${c.id}">${escaparHtml(c.nombre)}</option>`).join('')
    || '<option value="">Agregá un cliente primero</option>';
}

function renderSelectVentaProducto() {
  const sel = document.getElementById('venta-producto');
  sel.innerHTML = productos.map(p => `<option value="${p.id}">${escaparHtml(p.nombre)} (stock: ${p.stock})</option>`).join('')
    || '<option value="">Agregá un producto primero</option>';
}

document.getElementById('btn-agregar-item').addEventListener('click', () => {
  const productoId = document.getElementById('venta-producto').value;
  const cantidad = parseInt(document.getElementById('venta-cantidad').value, 10);
  const producto = productos.find(p => p.id === productoId);

  if (!producto || !cantidad || cantidad < 1) {
    mostrarMensaje('Elegí un producto y una cantidad válida.', true);
    return;
  }
  if (cantidad > producto.stock) {
    mostrarMensaje(`Solo hay ${producto.stock} en existencia de "${producto.nombre}".`, true);
    return;
  }

  carritoVenta.push({
    productoId: producto.id,
    nombre: producto.nombre,
    cantidad,
    precioUnitario: producto.precioVenta,
    costoUnitario: producto.costo,
    subtotal: producto.precioVenta * cantidad
  });
  renderCarrito();
});

function renderCarrito() {
  const cont = document.getElementById('carrito-venta');
  const total = carritoVenta.reduce((s, i) => s + i.subtotal, 0);
  cont.innerHTML = carritoVenta.map((i, idx) => `
    <div class="carrito-item">
      <span>${i.cantidad} × ${escaparHtml(i.nombre)} — ${formatoMoneda(i.subtotal)}</span>
      <button class="secundario" data-quitar="${idx}" style="padding:.2rem .6rem;">Quitar</button>
    </div>`).join('') || '<p class="vacio">Todavía no agregaste productos a esta venta.</p>';
  document.getElementById('total-venta').textContent = carritoVenta.length ? `Total: ${formatoMoneda(total)}` : '';
}

document.getElementById('carrito-venta').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-quitar]');
  if (!btn) return;
  carritoVenta.splice(Number(btn.dataset.quitar), 1);
  renderCarrito();
});

document.getElementById('btn-guardar-venta').addEventListener('click', async () => {
  if (!carritoVenta.length) {
    mostrarMensaje('Agregá al menos un producto a la venta.', true);
    return;
  }
  const clienteId = document.getElementById('venta-cliente').value;
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) {
    mostrarMensaje('Elegí un cliente para esta venta.', true);
    return;
  }
  const fechaLimiteStr = document.getElementById('venta-fecha-limite').value;
  const fechaLimitePago = fechaLimiteStr ? firebase.firestore.Timestamp.fromDate(new Date(fechaLimiteStr + 'T23:59:59')) : null;
  const total = carritoVenta.reduce((s, i) => s + i.subtotal, 0);
  const itemsVenta = carritoVenta.slice();

  try {
    // Transacción: descuenta el stock de cada producto y crea la venta
    // como una sola operación "todo o nada". Si dos ventas intentaran
    // descontar el mismo producto al mismo tiempo, Firestore reintenta
    // la transacción para que el stock nunca quede mal contado ni en
    // negativo.
    await db.runTransaction(async (tx) => {
      const refsProductos = itemsVenta.map(i => coleccion('productos').doc(i.productoId));
      const snaps = await Promise.all(refsProductos.map(r => tx.get(r)));

      snaps.forEach((snap, idx) => {
        const stockActual = snap.data().stock;
        if (stockActual < itemsVenta[idx].cantidad) {
          throw new Error(`Ya no hay suficiente stock de "${itemsVenta[idx].nombre}".`);
        }
      });

      snaps.forEach((snap, idx) => {
        tx.update(refsProductos[idx], { stock: snap.data().stock - itemsVenta[idx].cantidad });
      });

      const refVenta = coleccion('ventas').doc();
      tx.set(refVenta, {
        clienteId,
        clienteNombre: cliente.nombre,
        items: itemsVenta,
        total,
        totalAbonado: 0,
        estadoPago: 'pendiente',
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        fechaLimitePago
      });
    });

    carritoVenta = [];
    renderCarrito();
    document.getElementById('venta-fecha-limite').value = '';
    mostrarMensaje('Venta guardada.');
    await Promise.all([cargarProductos(), cargarVentas()]);
  } catch (err) {
    mostrarMensaje('No se pudo guardar la venta: ' + err.message, true);
  }
});

async function cargarVentas() {
  const snap = await coleccion('ventas').orderBy('fecha', 'desc').get();
  ventas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderVentas();
  renderSelectAbonoVenta();
  renderAlertasCobro();
}

function renderVentas() {
  const cont = document.getElementById('lista-ventas');
  if (!ventas.length) {
    cont.innerHTML = '<p class="vacio">Todavía no registraste ventas.</p>';
    return;
  }
  cont.innerHTML = `
    <table>
      <thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Abonado</th><th>Estado</th></tr></thead>
      <tbody>
        ${ventas.map(v => `
          <tr>
            <td>${formatoFecha(v.fecha)}</td>
            <td>${escaparHtml(v.clienteNombre)}</td>
            <td>${formatoMoneda(v.total)}</td>
            <td>${formatoMoneda(v.totalAbonado)}</td>
            <td><span class="badge ${v.estadoPago}">${v.estadoPago}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ============================================================
// COBROS / ABONOS
// ============================================================

function renderSelectAbonoVenta() {
  const sel = document.getElementById('abono-venta');
  const pendientes = ventas.filter(v => v.estadoPago !== 'pagada');
  sel.innerHTML = pendientes.map(v =>
    `<option value="${v.id}">${escaparHtml(v.clienteNombre)} — ${formatoMoneda(v.total - v.totalAbonado)} pendiente</option>`
  ).join('') || '<option value="">No hay ventas pendientes de cobro</option>';
}

document.getElementById('btn-guardar-abono').addEventListener('click', async () => {
  const ventaId = document.getElementById('abono-venta').value;
  const monto = parseFloat(document.getElementById('abono-monto').value);
  const venta = ventas.find(v => v.id === ventaId);

  if (!venta || isNaN(monto) || monto <= 0) {
    mostrarMensaje('Elegí una venta y un monto de abono válido.', true);
    return;
  }

  try {
    const refVenta = coleccion('ventas').doc(ventaId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(refVenta);
      const datos = snap.data();
      const nuevoAbonado = (datos.totalAbonado || 0) + monto;
      const nuevoEstado = nuevoAbonado >= datos.total ? 'pagada' : (nuevoAbonado > 0 ? 'parcial' : 'pendiente');
      tx.update(refVenta, { totalAbonado: nuevoAbonado, estadoPago: nuevoEstado });
      tx.set(refVenta.collection('abonos').doc(), {
        monto,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    document.getElementById('abono-monto').value = '';
    mostrarMensaje('Abono registrado.');
    await cargarVentas();
  } catch (err) {
    mostrarMensaje('No se pudo registrar el abono: ' + err.message, true);
  }
});

function renderAlertasCobro() {
  const cont = document.getElementById('lista-alertas');
  const hoy = new Date();
  const vencidas = ventas.filter(v => {
    if (v.estadoPago === 'pagada' || !v.fechaLimitePago) return false;
    const limite = v.fechaLimitePago.toDate ? v.fechaLimitePago.toDate() : new Date(v.fechaLimitePago);
    return limite < hoy;
  });
  if (!vencidas.length) {
    cont.innerHTML = '<p class="vacio">No hay cobros vencidos por ahora.</p>';
    return;
  }
  cont.innerHTML = vencidas.map(v => `
    <div class="alerta">
      <strong>${escaparHtml(v.clienteNombre)}</strong> — debe ${formatoMoneda(v.total - v.totalAbonado)},
      vencía el ${formatoFecha(v.fechaLimitePago)}.
    </div>`).join('');
}

// ============================================================
// REPORTES
// ============================================================

document.getElementById('btn-rep-dia').addEventListener('click', async () => {
  const valor = document.getElementById('rep-fecha-dia').value;
  if (!valor) { mostrarMensaje('Elegí una fecha.', true); return; }
  const inicio = new Date(valor + 'T00:00:00');
  const fin = new Date(valor + 'T23:59:59.999');
  await mostrarReporte(inicio, fin, 'resultado-rep-dia');
});

document.getElementById('btn-rep-mes').addEventListener('click', async () => {
  const valor = document.getElementById('rep-mes').value; // formato AAAA-MM
  if (!valor) { mostrarMensaje('Elegí un mes.', true); return; }
  const [anio, mes] = valor.split('-').map(Number);
  const inicio = new Date(anio, mes - 1, 1, 0, 0, 0);
  const fin = new Date(anio, mes, 0, 23, 59, 59, 999);
  await mostrarReporte(inicio, fin, 'resultado-rep-mes');
});

async function mostrarReporte(inicio, fin, idDestino) {
  try {
    const snap = await coleccion('ventas')
      .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(inicio))
      .where('fecha', '<=', firebase.firestore.Timestamp.fromDate(fin))
      .get();

    const filtradas = snap.docs.map(d => d.data());
    const totalVendido = filtradas.reduce((s, v) => s + v.total, 0);
    const gananciaEstimada = filtradas.reduce((s, v) =>
      s + v.items.reduce((s2, i) => s2 + (i.precioUnitario - (i.costoUnitario || 0)) * i.cantidad, 0), 0);

    document.getElementById(idDestino).innerHTML = `
      <table>
        <tbody>
          <tr><th>Ventas registradas</th><td>${filtradas.length}</td></tr>
          <tr><th>Total vendido</th><td>${formatoMoneda(totalVendido)}</td></tr>
          <tr><th>Ganancia estimada</th><td>${formatoMoneda(gananciaEstimada)}</td></tr>
        </tbody>
      </table>`;
  } catch (err) {
    mostrarMensaje('No se pudo generar el reporte: ' + err.message, true);
  }
}

// ============================================================
// Utilidades de escape (para que nombres de productos/clientes con
// símbolos raros nunca puedan romper el HTML de la página — esto
// evita un tipo de ataque conocido como "XSS almacenado").
// ============================================================
function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto == null ? '' : texto);
  return div.innerHTML;
}
function escaparAtributo(texto) {
  return escaparHtml(texto).replace(/"/g, '&quot;');
}

// ---------------- Punto de entrada ----------------
// app.js llama a esta función justo después de confirmar el login.
window.iniciarModuloNegocio = async function () {
  await Promise.all([cargarProductos(), cargarClientes()]);
  await cargarVentas();
};
