# MaestroPro – Asistente Digital Docente

## 1. Descripción del proyecto

MaestroPro es una aplicación web escolar que reúne herramientas de organización docente en un solo sitio. Permite administrar registros académicos de demostración, organizar actividades, consultar resultados y planificar el trabajo escolar.

## 2. Objetivo general

Desarrollar una herramienta digital sencilla que facilite la organización de actividades docentes mediante módulos conectados y una interfaz adaptable a computadoras, tabletas y teléfonos.

## 3. Necesidad que atiende

La información de un docente puede quedar repartida entre listas, calendarios, notas y archivos diferentes. MaestroPro propone reunir funciones frecuentes en un panel con navegación común, formularios y consultas.

## 4. Módulos y funciones

1. **Inicio:** muestra indicadores generales, accesos rápidos, tareas pendientes y próximos eventos.
2. **Alumnos:** permite registrar, buscar, filtrar, editar y eliminar alumnos ficticios.
3. **Grupos y materias:** organiza grupos, asignaturas y docentes de demostración.
4. **Asistencia:** registra presentes, faltas y retardos por grupo y fecha; conserva un historial.
5. **Calificaciones:** captura resultados, calcula promedios y permite exportar un CSV.
6. **Tareas:** organiza actividades por grupo, fecha de entrega y estado.
7. **Planeaciones:** registra tema, propósito, actividades y materiales.
8. **Exámenes:** organiza evaluaciones por materia, grupo, fecha e indicaciones.
9. **Calendario escolar:** presenta una vista mensual, distingue eventos por colores, permite seleccionar fechas, registrar, buscar, filtrar, editar y eliminar eventos.
10. **Biblioteca:** organiza recursos, enlaces y descripciones; incorpora búsqueda, filtros y estadísticas por tipo.
11. **Rúbricas:** permite crear criterios de evaluación, uno por línea.
12. **Evaluaciones:** carga los criterios de una rúbrica, permite valorarlos de 1 a 4 y calcula un resultado porcentual.
13. **Historial:** conserva resultados y permite consultar el detalle de cada criterio y sus observaciones.
14. **Reportes:** muestra indicadores de asistencia, tareas, calificaciones y registros por módulo; permite imprimir y exportar calificaciones.
15. **Usuarios:** muestra perfiles de demostración y sus roles descriptivos.
16. **Asistente Digital Docente:** organiza solicitudes relacionadas con planeaciones, actividades, evaluaciones y materiales.
17. **Respaldos y restauración:** descarga y restaura los datos mediante archivos JSON.
18. **Configuración:** permite modificar el nombre del centro educativo y elegir tema claro u oscuro.

## 5. Tecnologías utilizadas

- **HTML:** organiza la estructura de las pantallas y los formularios.
- **CSS:** define colores, distribución, componentes visuales y adaptación a distintos tamaños de pantalla.
- **JavaScript:** controla la navegación, validación, cálculos, filtros, edición, eliminación y actualización de los módulos.
- **LocalStorage:** conserva los datos en el navegador del equipo donde se utiliza la aplicación.

## 6. Cómo funciona

El usuario navega por el menú lateral y abre el módulo que necesita. Los formularios validan los campos obligatorios. JavaScript procesa cada registro y guarda los cambios en LocalStorage. Las listas, indicadores y reportes se actualizan después de las operaciones. Los respaldos JSON permiten conservar una copia y restaurar información compatible.

## 7. Guion breve para demostrar la aplicación

1. Abrir **Inicio** y explicar los indicadores generales.
2. Entrar en **Grupos y materias** y mostrar un grupo de ejemplo.
3. Entrar en **Alumnos** y registrar un alumno ficticio.
4. Abrir **Asistencia** y marcar presentes, faltas o retardos.
5. Registrar una **Calificación** y una **Tarea**.
6. Entrar en **Calendario escolar**, registrar un evento y mostrar sus colores y filtros.
7. Abrir **Biblioteca** para enseñar búsqueda y estadísticas por tipo.
8. Abrir **Rúbricas** y después **Evaluaciones** para mostrar el cálculo por criterio.
9. Consultar el **Historial** y abrir el detalle de una evaluación.
10. Mostrar **Reportes** y finalizar con **Respaldos y restauración**.

## 8. Alcances y limitaciones

MaestroPro es una demostración local. No tiene servidor, inicio de sesión seguro, permisos institucionales, cifrado ni sincronización entre dispositivos. El módulo Asistente Digital Docente organiza solicitudes, pero no utiliza inteligencia artificial. Los datos de ejemplo son ficticios. No se deben introducir datos personales ni información académica real de estudiantes.

## 9. Conclusión

MaestroPro integra en una sola aplicación herramientas para organizar grupos, alumnos, asistencia, calificaciones, tareas, planeaciones, evaluaciones y recursos. Su diseño modular permite localizar cada función con facilidad y su almacenamiento local permite realizar una demostración sin depender de servicios externos.
