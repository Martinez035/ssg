/* SGG - Módulo de Gestión de Gastos (CRUD) */
(function () {
  'use strict';

  // ===== Configuración (ajustar a las claves que usa el módulo de autenticación) =====
  var CLAVE_SESION = 'usuario_activo';   // sesión guardada por el login (email o JSON con .email)
  var CLAVE_GASTOS = 'gastos_sgg';       // array de gastos en localStorage
  var CLAVE_TEMA = 'tema';               // 'dark' | 'light' (heredado del módulo anterior)
  var PAGINA_LOGIN = 'index.html';

  // ===== Sesión y seguridad de rutas =====
  function obtenerUsuarioActivo() {
    var crudo = localStorage.getItem(CLAVE_SESION) || sessionStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;
    try {
      var obj = JSON.parse(crudo);
      if (obj && typeof obj === 'object') return obj.email || null;
      return typeof obj === 'string' ? obj : null;
    } catch (e) {
      return crudo; // texto plano
    }
  }

  var usuario = obtenerUsuarioActivo();
  if (!usuario) {
    window.location.replace(PAGINA_LOGIN);
    return;
  }

  // ===== Persistencia =====
  function leerGastos() {
    try {
      var data = JSON.parse(localStorage.getItem(CLAVE_GASTOS));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  function guardarGastos(lista) {
    localStorage.setItem(CLAVE_GASTOS, JSON.stringify(lista));
  }
  function gastosActivosDelUsuario() {
    return leerGastos().filter(function (g) {
      return g.email_usuario === usuario && g.estado_activo === true;
    });
  }

  // ===== Referencias al DOM =====
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form-gasto');
  var campos = {
    monto: $('monto'), fecha: $('fecha'),
    categoria: $('categoria'), descripcion: $('descripcion')
  };
  var inputId = $('gasto-id');
  var btnGuardar = $('btn-guardar');
  var btnCancelar = $('btn-cancelar');
  var cuerpo = $('cuerpo-tabla');
  var msgVacio = $('mensaje-vacio');
  var totalEl = $('total-gastado');
  var modal = $('modal-eliminar');
  var idPendienteEliminar = null;

  $('usuario-activo').textContent = usuario;

  var formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  // ===== Validación (RF-05) =====
  function mostrarError(campo, mensaje) {
    $('err-' + campo).textContent = mensaje;
    campos[campo].setAttribute('aria-invalid', mensaje ? 'true' : 'false');
  }
  function validar() {
    var ok = true;
    var monto = parseFloat(campos.monto.value);
    if (isNaN(monto) || monto <= 0) {
      mostrarError('monto', 'El monto debe ser mayor a cero.'); ok = false;
    } else mostrarError('monto', '');
    if (!campos.fecha.value) {
      mostrarError('fecha', 'Ingresá una fecha.'); ok = false;
    } else mostrarError('fecha', '');
    if (!campos.categoria.value) {
      mostrarError('categoria', 'Seleccioná una categoría.'); ok = false;
    } else mostrarError('categoria', '');
    if (!campos.descripcion.value.trim()) {
      mostrarError('descripcion', 'Ingresá una descripción.'); ok = false;
    } else mostrarError('descripcion', '');
    return ok;
  }

  // ===== Render (RF-06) y total (RF-09) =====
  function render() {
    var lista = gastosActivosDelUsuario().sort(function (a, b) {
      return b.fecha.localeCompare(a.fecha);
    });
    cuerpo.textContent = '';
    msgVacio.hidden = lista.length > 0;
    var total = 0;

    lista.forEach(function (g) {
      total += g.monto;
      var tr = document.createElement('tr');
      [g.fecha, g.categoria, g.descripcion].forEach(function (txt) {
        var td = document.createElement('td');
        td.textContent = txt; // textContent evita inyección de HTML
        tr.appendChild(td);
      });
      var tdMonto = document.createElement('td');
      tdMonto.className = 'num';
      tdMonto.textContent = formatoMoneda.format(g.monto);
      tr.appendChild(tdMonto);

      var tdAcc = document.createElement('td');
      var cont = document.createElement('div');
      cont.className = 'acciones';
      var bEd = document.createElement('button');
      bEd.type = 'button';
      bEd.className = 'btn btn-secundario btn-sm';
      bEd.textContent = 'Editar';
      bEd.setAttribute('aria-label', 'Editar gasto: ' + g.descripcion);
      bEd.addEventListener('click', function () { iniciarEdicion(g.id); });
      var bEl = document.createElement('button');
      bEl.type = 'button';
      bEl.className = 'btn btn-peligro btn-sm';
      bEl.textContent = 'Eliminar';
      bEl.setAttribute('aria-label', 'Eliminar gasto: ' + g.descripcion);
      bEl.addEventListener('click', function () { pedirConfirmacion(g.id, g.descripcion); });
      cont.appendChild(bEd);
      cont.appendChild(bEl);
      tdAcc.appendChild(cont);
      tr.appendChild(tdAcc);
      cuerpo.appendChild(tr);
    });

    totalEl.textContent = formatoMoneda.format(total);
  }

  // ===== Create / Update (RF-05, RF-07) =====
  function resetFormulario() {
    form.reset();
    inputId.value = '';
    ['monto', 'fecha', 'categoria', 'descripcion'].forEach(function (c) { mostrarError(c, ''); });
    btnGuardar.textContent = 'Guardar gasto';
    btnCancelar.hidden = true;
    $('titulo-form').textContent = 'Cargar gasto';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validar()) return;

    var datos = {
      monto: Math.round(parseFloat(campos.monto.value) * 100) / 100,
      fecha: campos.fecha.value,
      categoria: campos.categoria.value,
      descripcion: campos.descripcion.value.trim()
    };
    var lista = leerGastos();

    if (inputId.value) {
      // Update: solo sobre gastos del usuario activo
      lista.forEach(function (g) {
        if (g.id === inputId.value && g.email_usuario === usuario) {
          g.monto = datos.monto; g.fecha = datos.fecha;
          g.categoria = datos.categoria; g.descripcion = datos.descripcion;
        }
      });
    } else {
      lista.push({
        id: 'g_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        email_usuario: usuario,
        monto: datos.monto,
        fecha: datos.fecha,
        categoria: datos.categoria,
        descripcion: datos.descripcion,
        estado_activo: true
      });
    }
    guardarGastos(lista);
    resetFormulario();
    render();
  });

  function iniciarEdicion(id) {
    var g = gastosActivosDelUsuario().find(function (x) { return x.id === id; });
    if (!g) return;
    inputId.value = g.id;
    campos.monto.value = g.monto;
    campos.fecha.value = g.fecha;
    campos.categoria.value = g.categoria;
    campos.descripcion.value = g.descripcion;
    btnGuardar.textContent = 'Actualizar gasto';
    btnCancelar.hidden = false;
    $('titulo-form').textContent = 'Editar gasto';
    campos.monto.focus();
  }
  btnCancelar.addEventListener('click', resetFormulario);

  // ===== Delete con baja lógica (RF-08): sin splice, solo cambio de estado =====
  function pedirConfirmacion(id, descripcion) {
    idPendienteEliminar = id;
    $('modal-texto').textContent = '¿Seguro que querés eliminar "' + descripcion + '"?';
    modal.showModal();
  }
  $('modal-confirmar').addEventListener('click', function () {
    var lista = leerGastos();
    lista.forEach(function (g) {
      if (g.id === idPendienteEliminar && g.email_usuario === usuario) {
        g.estado_activo = false; // baja lógica
      }
    });
    guardarGastos(lista);
    idPendienteEliminar = null;
    modal.close();
    render();
  });
  $('modal-cancelar').addEventListener('click', function () {
    idPendienteEliminar = null;
    modal.close();
  });

  // ===== Cerrar sesión =====
  $('btn-salir').addEventListener('click', function () {
    localStorage.removeItem(CLAVE_SESION);
    sessionStorage.removeItem(CLAVE_SESION);
    window.location.replace(PAGINA_LOGIN);
  });

  // ===== Modo Día/Noche persistente =====
  var btnTema = $('btn-tema');
  function aplicarTema(t) {
    document.documentElement.setAttribute('data-theme', t);
    var noche = t === 'dark';
    btnTema.textContent = noche ? 'Modo día' : 'Modo noche';
    btnTema.setAttribute('aria-pressed', String(noche));
  }
  aplicarTema(localStorage.getItem(CLAVE_TEMA) === 'dark' ? 'dark' : 'light');
  btnTema.addEventListener('click', function () {
    var nuevo = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(CLAVE_TEMA, nuevo);
    aplicarTema(nuevo);
  });

  render();
})();
