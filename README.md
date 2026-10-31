# Órbita Express · Dashboard gerencial

Aplicación web en React para explorar el caso académico de Órbita Express. La interfaz adapta el PDF de referencia y utiliza los datos reales del Excel adjunto, que el propio expediente identifica como ficticios para simulación académica.

## Abrir sin instalar

Descarga `orbita-express.html` y ábrelo con doble clic en un navegador moderno. Esta versión incluye datos, estilos, fuentes y dependencias; no necesita servidor ni conexión para el análisis y el mapa local. La vista principal del mapa usa Google Maps y requiere internet; puedes cambiar a «Mapa sin conexión». Admite filtros, simulación e importación de Excel/CSV. Para regenerarla desde el proyecto: `node scripts/export-standalone.mjs`.

## Ejecutar

Requisitos: Node.js 22 o posterior y npm.

```bash
cd /workspace/hola-mundo-
npm ci --no-audit --no-fund
npm run dev -- --port 5173
```

Para generar la versión estática:

```bash
npm run build
npm run preview -- --port 4173
```

La carpeta `dist/` contiene la página compilada y sus recursos. Debe servirse mediante HTTP, no abriendo `index.html` con `file://`.

## Funciones

- Resumen ejecutivo con indicadores calculados y tendencias.
- Operaciones: comparación por centro, zona y segmento; búsqueda, ordenación y paginación de conductores.
- Mapa de Colombia: centros de referencia, indicadores filtrados, zoom y Google Maps como vista principal.
- Rutas por ciudad: tres recorridos y doce puntos simulados, selección de punto, esquema interactivo y recorrido integrado en Google Maps.
- Personal: plantilla, rotación, formación, ausencias y horas extra.
- Finanzas: resultados mensuales, cartera y efectivo de cierre; rentabilidad de la muestra por cliente.
- Portafolio: 12 alternativas del expediente, selección dentro del presupuesto de 1.000 MM COP y descuento A9/A5.
- Simulador: palancas operativas y de cobranza, supuestos visibles y guardado local de escenarios.
- Alertas y auditoría de calidad de datos.
- Importación de Excel o CSV, exportación de CSV e impresión como PDF.
- Diseño adaptable a escritorio y móvil; navegación por teclado y diálogos con control de foco.

## Fuente y criterios

`src/data/workbook.json` contiene 3.000 envíos, 12 registros mensuales de personal, 12 financieros y 12 alternativas de inversión, extraídos del archivo `orbita_express_base_simulacion_marco_logico.xlsx`. No se generan envíos aleatorios.

Resultados de referencia de 2025: puntualidad 46,53%; reclamos 14,13%; devoluciones 9,60%; ingresos corporativos 12.305 MM COP; utilidad operativa 543 MM COP; margen 4,41%; cierre de diciembre: cartera vencida 1.166 MM COP y efectivo 280 MM COP.

- Los envíos son una **muestra**. Sus valores no se extrapolan a las finanzas corporativas.
- Personal y finanzas solo tienen granularidad mensual. Los filtros por centro, cliente, zona, segmento y conductor afectan únicamente los envíos.
- Cartera y efectivo se toman del último mes seleccionado, sin sumar saldos.
- Las tasas utilizan valores conocidos y muestran «—» si no hay denominador válido. Los datos faltantes no se sustituyen por ceros.
- «Registro completo» es un indicador de la fuente, distinto de la auditoría de celdas vacías.
- Los umbrales de alertas, relaciones problema–objetivo y coeficientes del simulador son orientativos. No se presentan como SLA, causalidad demostrada o un portafolio aprobado.
- El PDF contiene conversaciones históricas y propuestas de integración. No constituye evidencia de una conexión activa ni de un portafolio aprobado.

## Cargar datos

En **Cargar datos**, utiliza un libro con las hojas `Envios_muestra`, `Personal_mensual`, `Finanzas_mensual` y opcionalmente `Ofertas_inversion` y las hojas de contexto. También puedes cargar un CSV con los encabezados originales de envíos. El importador reconoce encabezados con o sin acentos, fechas de Excel y fechas de texto; informa valores inválidos, celdas vacías y duplicados. Las filas con IDs repetidos se descartan y se reportan. Las hojas mensuales con meses duplicados se rechazan.

Un CSV de envíos reemplaza la muestra y conserva los datos mensuales existentes. Una carga de Excel reemplaza sus conjuntos de datos. Las cargas permanecen en memoria: al recargar se restaura el archivo base. Los escenarios se guardan en `localStorage` del navegador.

Los datos se procesan localmente. No hay conexión con Google Sheets, Drive o Firebase, ni sincronización de terceros. No se necesitan secretos para ejecutar esta versión. No incluye autenticación; la publicación de GitHub Pages es una demostración del caso académico.

## Verificación

```bash
npm test
npm run build
```

Las pruebas cubren métricas del Excel, periodos y dimensiones, valores faltantes, saldos de cierre, fechas de Excel, validación de encabezados y duplicados. También se verificaron en Chromium los filtros, ocho módulos, selección de alternativas, controles del simulador, guardado, exportación, importación del Excel original y navegación móvil.

## Publicar en GitHub Pages

El sitio usa rutas relativas y está preparado para `https://soporteglobalhitss88-design.github.io/hola-mundo-/`.

La rama `main` conserva el código fuente. La rama `gh-pages` debe contener exclusivamente el contenido generado de `dist/`, con `.nojekyll`, `index.html` y sus recursos. En GitHub, activa **Settings → Pages → Build and deployment → Deploy from a branch → gh-pages → / (root) → Save**. La existencia de la rama no activa Pages por sí sola.

Para activar o comprobar Pages con la CLI, el entorno necesita acceso a `api.github.com`, además de permisos administrativos/de Pages en el repositorio. La verificación del sitio necesita acceso a `soporteglobalhitss88-design.github.io`. Si estos dominios están bloqueados, deben habilitarse en la configuración del entorno; no se deben extraer tokens del proxy ni desactivar TLS.

El sitio publica exclusivamente el caso académico identificado como ficticio. Los nuevos archivos cargados se procesan en el navegador del visitante y no se suben al repositorio.

## Mapa de centros

El mapa local usa el contorno de Colombia de Natural Earth, de dominio público, y coordenadas de referencia de Bogotá, Medellín, Cali y Barranquilla. No contiene geolocalización de entregas, conductores o rutas reales. Los puntos resumen la muestra seleccionada.

Puedes seleccionar un centro, aplicar los filtros generales, acercar o alejar el mapa, restablecer la vista y centrar la ciudad en Google Maps dentro de la página. Al entrar al módulo del mapa, se muestra Google Maps por defecto mediante un iframe externo; no requiere claves API para esta consulta de referencia. Puedes cambiar a «Mapa sin conexión» como alternativa local. Esta vista depende de la conexión del visitante y de la disponibilidad de Google. El mapa local funciona sin ella.

Google Maps se utiliza directamente dentro del dashboard: el iframe permite arrastrar y navegar; la barra del dashboard ajusta zoom, restablece Colombia y amplía el mapa dentro de la misma página. Los botones «Ver en el mapa» centran el mapa integrado sin abrir pestañas. Las ubicaciones siguen siendo referencias de las ciudades, no rastreo GPS de los envíos.

## Rutas y puntos por ciudad

Bogotá, Medellín, Cali y Barranquilla tienen tres rutas ilustrativas (Norte, Centro y Sur), con cuatro puntos de referencia por ruta y una base de salida. En «Ciudad de la ruta» selecciona la ciudad y en «Recorrido» elige una ruta. El mapa integrado recibe los puntos en su orden; «Ver ruta completa» restaura el recorrido después de enfocar un punto.

Debajo del mapa, el esquema muestra las tres rutas y los doce puntos de cada ciudad, incluso sin conexión. Puedes hacer clic en un punto del esquema o de la lista para enfocarlo en Google Maps. Las líneas del esquema son conexiones orientativas entre puntos, no trazados viales. El renderizado del recorrido de Google depende del servicio externo; el esquema y la lista permanecen disponibles.

Las coordenadas y la asignación de envíos a rutas son **simuladas**: no proceden de direcciones de clientes, GPS ni asignaciones de despacho. Los conteos, reclamos y puntualidad se calculan con los envíos filtrados distribuidos de forma estable entre esos puntos, sin crear envíos adicionales. Los puntos de cada envío se conservan al cambiar periodo o filtros.
