'use strict';

/* ==========================================================
   MAESTROPRO · ASISTENTE DIGITAL DOCENTE
   Versión escolar de demostración, funcionamiento local.
========================================================== */

const STORAGE_KEY = 'maestropro_demo_v1';
const pageContent = document.getElementById('pageContent');
const pageTitle = document.getElementById('pageTitle');
const toastRegion = document.getElementById('toastRegion');

const pageNames = {
  inicio: 'Inicio', alumnos: 'Alumnos', grupos: 'Grupos y materias',
  asistencia: 'Control de asistencia', calificaciones: 'Calificaciones',
  tareas: 'Tareas', planeaciones: 'Planeaciones', examenes: 'Exámenes',
  calendario: 'Calendario escolar', biblioteca: 'Biblioteca', rubricas: 'Rúbricas',
  evaluaciones: 'Evaluaciones', historial: 'Historial de evaluaciones',
  reportes: 'Reportes', usuarios: 'Usuarios', asistente: 'Asistente Digital Docente',
  respaldos: 'Respaldos y restauración', configuracion: 'Configuración'
};

const DATA_COLLECTIONS = [
  'students', 'groups', 'attendance', 'grades', 'tasks', 'plans', 'exams',
  'resources', 'rubrics', 'evaluations', 'events', 'users', 'assistant'
];

let currentPage = 'inicio';
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let selectedCalendarDate = todayISO();
let calendarSearch = '';
let calendarFilter = '';
let librarySearch = '';
let libraryFilter = '';
let studentSearch = '';
let studentGroupFilter = '';
let taskFilter = '';
let gradeFilter = '';
let editingEventId = null;
let editingRecord = null;
let evaluationDetailId = null;
let db = loadData();

function uid() {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function safeDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? escapeHTML(value) : date.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}
function seedData() {
  const groupId = 'g-demo-1';
  return {
    students: [
      { id: 's-demo-1', name: 'Alumno de ejemplo 1', groupId, status: 'Activo' },
      { id: 's-demo-2', name: 'Alumno de ejemplo 2', groupId, status: 'Activo' },
      { id: 's-demo-3', name: 'Alumno de ejemplo 3', groupId, status: 'Activo' }
    ],
    groups: [{ id: groupId, name: '1.º A', subject: 'Formación general', teacher: 'Docente de ejemplo' }],
    attendance: [], grades: [],
    tasks: [{ id: 't-demo-1', title: 'Actividad de repaso', groupId, dueDate: todayISO(), status: 'Pendiente', description: 'Tarea de demostración.' }],
    plans: [], exams: [], resources: [],
    rubrics: [{
      id: 'r-demo-1', title: 'Rúbrica de exposición',
      criteria: 'Dominio del tema\nClaridad al explicar\nOrganización de ideas\nMaterial de apoyo'
    }],
    evaluations: [], events: [],
    users: [{ id: 'u-demo-1', name: 'Docente de demostración', role: 'Administrador' }],
    assistant: [],
    settings: { schoolName: 'Mi centro educativo', theme: 'light' }
  };
}
function normalizeData(candidate) {
  const base = seedData();
  const source = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
  const normalized = { ...base };
  DATA_COLLECTIONS.forEach(key => {
    normalized[key] = Array.isArray(source[key]) ? source[key] : base[key];
  });
  normalized.settings = {
    ...base.settings,
    ...(source.settings && typeof source.settings === 'object' ? source.settings : {})
  };
  normalized.settings.schoolName = String(normalized.settings.schoolName || 'Mi centro educativo').slice(0, 100);
  normalized.settings.theme = normalized.settings.theme === 'dark' ? 'dark' : 'light';
  // Compatibilidad con evaluaciones creadas en versiones anteriores.
  normalized.evaluations = normalized.evaluations.map(item => ({
    ...item,
    criterionScores: Array.isArray(item.criterionScores) ? item.criterionScores : [],
    rubricTitle: item.rubricTitle || normalized.rubrics.find(r => r.id === item.rubricId)?.title || 'Rúbrica'
  }));
  return normalized;
}
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeData(JSON.parse(saved));
  } catch (error) {
    console.warn('No se pudieron leer los datos locales:', error);
  }

  // Intenta recuperar datos del proyecto anterior (claves mp_*).
  const legacyMap = {
    students: ['mp_students'], groups: ['mp_groups'], attendance: ['mp_attendance'],
    grades: ['mp_grades'], tasks: ['mp_tasks'], plans: ['mp_plans', 'mp_planeaciones'],
    exams: ['mp_exams'], resources: ['mp_resources', 'mp_library'],
    rubrics: ['mp_rubrics'], evaluations: ['mp_evaluations'],
    events: ['mp_calendar', 'mp_events'], users: ['mp_users'], assistant: ['mp_assistant']
  };
  const migrated = {};
  let foundLegacy = false;
  Object.entries(legacyMap).forEach(([collection, keys]) => {
    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(value)) {
          migrated[collection] = value;
          foundLegacy = true;
          break;
        }
      } catch (_) { /* Ignorar claves antiguas dañadas. */ }
    }
  });
  if (foundLegacy) {
    const normalized = normalizeData(migrated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (_) { /* Se conserva en memoria. */ }
    return normalized;
  }
  return seedData();
}
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (error) {
    console.error('Error al guardar los datos locales:', error);
    toast('No se pudo guardar. Revisa el almacenamiento disponible del navegador.');
    return false;
  }
}
function toast(message) {
  if (!toastRegion) return;
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  toastRegion.appendChild(item);
  window.setTimeout(() => item.remove(), 3200);
}
function groupName(id) { return db.groups.find(item => item.id === id)?.name || 'Sin grupo'; }
function studentName(id) { return db.students.find(item => item.id === id)?.name || 'Alumno no disponible'; }
function selectOptions(items, selected = '', emptyLabel = 'Selecciona una opción') {
  return `<option value="">${escapeHTML(emptyLabel)}</option>` + items.map(item =>
    `<option value="${escapeHTML(item.id)}" ${item.id === selected ? 'selected' : ''}>${escapeHTML(item.label)}</option>`
  ).join('');
}
function moduleHeader(title, description, action = '') {
  return `<div class="module-header"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div>${action ? `<div class="module-actions">${action}</div>` : ''}</div>`;
}
function card(title, content, subtitle = '') {
  return `<section class="card"><h2>${escapeHTML(title)}</h2>${subtitle ? `<p class="card-subtitle">${escapeHTML(subtitle)}</p>` : ''}${content}</section>`;
}
function emptyState(message) { return `<div class="empty-state">${escapeHTML(message)}</div>`; }
function actionButtons(type, id) {
  return `<button type="button" class="btn btn-secondary btn-small" data-action="edit" data-type="${escapeHTML(type)}" data-id="${escapeHTML(id)}">Editar</button> <button type="button" class="btn btn-danger btn-small" data-action="delete" data-type="${escapeHTML(type)}" data-id="${escapeHTML(id)}">Eliminar</button>`;
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}">${emptyState('Todavía no hay registros.')}</td></tr>`}</tbody></table></div>`;
}
function field(label, name, type = 'text', value = '', required = true, extra = '') {
  return `<div class="form-group"><label for="${escapeHTML(name)}">${escapeHTML(label)}</label><input id="${escapeHTML(name)}" name="${escapeHTML(name)}" type="${escapeHTML(type)}" value="${escapeHTML(value)}" ${required ? 'required' : ''} ${extra}></div>`;
}
function selectField(label, name, options, required = true) {
  return `<div class="form-group"><label for="${escapeHTML(name)}">${escapeHTML(label)}</label><select id="${escapeHTML(name)}" name="${escapeHTML(name)}" ${required ? 'required' : ''}>${options}</select></div>`;
}
function textArea(label, name, value = '', required = false) {
  return `<div class="form-group full"><label for="${escapeHTML(name)}">${escapeHTML(label)}</label><textarea id="${escapeHTML(name)}" name="${escapeHTML(name)}" ${required ? 'required' : ''}>${escapeHTML(value)}</textarea></div>`;
}
function formCard(title, formId, fields, submit = 'Guardar registro', extra = '') {
  return `<section class="card"><h2>${escapeHTML(title)}</h2><form id="${escapeHTML(formId)}" class="form-grid" autocomplete="off">${fields}<div class="form-group full form-actions"><button class="btn btn-primary" type="submit">${escapeHTML(submit)}</button>${extra}</div></form></section>`;
}
function getGroupOptions(selected = '') {
  return selectOptions(db.groups.map(item => ({ id: item.id, label: item.name })), selected, 'Selecciona un grupo');
}
function getStudentOptions(selected = '') {
  return selectOptions(db.students.map(item => ({ id: item.id, label: item.name })), selected, 'Selecciona un alumno');
}
function countUpcoming() { return db.events.filter(event => event.date >= todayISO()).length; }
function statusBadge(status) {
  const cls = status === 'Presente' || status === 'Activo' || status === 'Completada' ? 'green'
    : status === 'Falta' || status === 'Inactivo' ? 'red'
      : status === 'Retardo' || status === 'En proceso' ? 'orange' : 'gray';
  return `<span class="badge ${cls}">${escapeHTML(status)}</span>`;
}

/* INICIO */
function renderHome() {
  const pending = db.tasks.filter(task => task.status !== 'Completada').length;
  const nextEvents = db.events.filter(event => event.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const recentTasks = db.tasks.filter(task => task.status !== 'Completada').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
  const quick = [
    ['alumnos', '♙', 'Alumnos', 'Consultar registros'], ['asistencia', '✓', 'Asistencia', 'Tomar lista'],
    ['planeaciones', '▧', 'Planeaciones', 'Organizar clases'], ['calendario', '▦', 'Calendario', 'Ver actividades']
  ];
  return `<div class="welcome"><div><span class="eyebrow">ASISTENTE DIGITAL DOCENTE</span><h2>¡Bienvenido a MaestroPro!</h2><p>Organiza tus actividades académicas, grupos, evaluaciones y recursos desde un solo lugar.</p></div><div class="welcome-mark">✦</div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">♙</div><div><strong>${db.students.length}</strong><small>Alumnos de ejemplo</small></div></div>
      <div class="stat-card"><div class="stat-icon">▦</div><div><strong>${db.groups.length}</strong><small>Grupos registrados</small></div></div>
      <div class="stat-card"><div class="stat-icon">✎</div><div><strong>${pending}</strong><small>Tareas pendientes</small></div></div>
      <div class="stat-card"><div class="stat-icon">▣</div><div><strong>${countUpcoming()}</strong><small>Próximos eventos</small></div></div>
    </div>
    <div class="content-grid">
      ${card('Accesos rápidos', `<div class="quick-actions">${quick.map(([page, icon, title, sub]) => `<button type="button" class="quick-action" data-go="${page}"><span>${icon}</span><strong>${title}</strong><small>${sub}</small></button>`).join('')}</div>`)}
      ${card('Próximos eventos', nextEvents.length ? `<div class="list-stack">${nextEvents.map(event => `<div class="list-item"><div><strong>${escapeHTML(event.title)}</strong><small>${safeDate(event.date)} · ${escapeHTML(event.type)}</small></div>${statusBadge(event.type)}</div>`).join('')}</div>` : emptyState('No hay eventos próximos. Agrega uno desde el calendario.'))}
      ${card('Tareas por atender', recentTasks.length ? `<div class="list-stack">${recentTasks.map(task => `<div class="list-item"><div><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(groupName(task.groupId))} · Entrega: ${safeDate(task.dueDate)}</small></div>${statusBadge(task.status)}</div>`).join('')}</div>` : emptyState('No hay tareas pendientes.'))}
      ${card('Resumen de seguimiento', `<div class="metric-lines"><div><span>Calificaciones registradas</span><strong>${db.grades.length}</strong></div><div><span>Evaluaciones con rúbrica</span><strong>${db.evaluations.length}</strong></div><div><span>Recursos en biblioteca</span><strong>${db.resources.length}</strong></div><div><span>Planeaciones guardadas</span><strong>${db.plans.length}</strong></div></div>`) }
    </div>
    <div class="notice blue">Proyecto escolar de demostración. La información se guarda en este navegador. Utiliza únicamente datos ficticios; no registres datos personales ni calificaciones reales de estudiantes.</div>`;
}

/* ALUMNOS Y GRUPOS */
function renderStudents() {
  const fields = field('Nombre ficticio del alumno', 'name') + selectField('Grupo', 'groupId', getGroupOptions()) + selectField('Estado', 'status', '<option>Activo</option><option>Inactivo</option>');
  const filtered = db.students.filter(student =>
    (!studentSearch || student.name.toLowerCase().includes(studentSearch.toLowerCase())) &&
    (!studentGroupFilter || student.groupId === studentGroupFilter)
  );
  const rows = filtered.map(student => `<tr><td>${escapeHTML(student.name)}</td><td>${escapeHTML(groupName(student.groupId))}</td><td>${statusBadge(student.status)}</td><td>${actionButtons('students', student.id)}</td></tr>`);
  const filters = `<div class="toolbar"><input id="studentSearch" type="search" placeholder="Buscar alumno..." value="${escapeHTML(studentSearch)}"><select id="studentGroupFilter"><option value="">Todos los grupos</option>${db.groups.map(group => `<option value="${escapeHTML(group.id)}" ${studentGroupFilter === group.id ? 'selected' : ''}>${escapeHTML(group.name)}</option>`).join('')}</select><span class="muted">${filtered.length} de ${db.students.length} alumnos</span></div>`;
  return moduleHeader('Alumnos', 'Registra, consulta, edita y organiza alumnos de demostración.') + '<div class="notice">Usa nombres ficticios. Esta aplicación escolar no cuenta con autenticación ni protección institucional de datos.</div>' + formCard(editingRecord?.type === 'students' ? 'Editar alumno' : 'Registrar alumno', 'studentForm', fields, editingRecord?.type === 'students' ? 'Actualizar alumno' : 'Guardar alumno', editingRecord?.type === 'students' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') + card('Lista de alumnos', filters + table(['Nombre', 'Grupo', 'Estado', 'Acciones'], rows));
}
function renderGroups() {
  const fields = field('Nombre del grupo', 'name') + field('Materia o área', 'subject') + field('Docente (nombre ficticio)', 'teacher');
  const rows = db.groups.map(group => `<tr><td>${escapeHTML(group.name)}</td><td>${escapeHTML(group.subject)}</td><td>${escapeHTML(group.teacher)}</td><td>${db.students.filter(student => student.groupId === group.id).length}</td><td>${actionButtons('groups', group.id)}</td></tr>`);
  return moduleHeader('Grupos y materias', 'Administra grupos, asignaturas y docentes de demostración.') + formCard(editingRecord?.type === 'groups' ? 'Editar grupo' : 'Registrar grupo o materia', 'groupForm', fields, editingRecord?.type === 'groups' ? 'Actualizar grupo' : 'Guardar grupo', editingRecord?.type === 'groups' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') + card('Grupos registrados', table(['Grupo', 'Materia', 'Docente', 'Alumnos', 'Acciones'], rows));
}

/* ASISTENCIA */
function attendanceStudentList(groupId, date = todayISO()) {
  const students = db.students.filter(student => student.groupId === groupId && student.status !== 'Inactivo');
  if (!students.length) return emptyState('No hay alumnos activos en este grupo.');
  return students.map(student => {
    const saved = db.attendance.find(item => item.date === date && item.groupId === groupId && item.studentId === student.id);
    const status = saved?.status || 'Presente';
    return `<div class="list-item attendance-item"><strong>${escapeHTML(student.name)}</strong><select name="status_${escapeHTML(student.id)}" aria-label="Estado de ${escapeHTML(student.name)}"><option ${status === 'Presente' ? 'selected' : ''}>Presente</option><option ${status === 'Falta' ? 'selected' : ''}>Falta</option><option ${status === 'Retardo' ? 'selected' : ''}>Retardo</option></select></div>`;
  }).join('');
}
function renderAttendance() {
  const firstGroup = db.groups[0]?.id || '';
  const groupId = document.getElementById('attendanceForm')?.elements.namedItem('groupId')?.value || firstGroup;
  const date = document.getElementById('attendanceForm')?.elements.namedItem('date')?.value || todayISO();
  const fields = field('Fecha', 'date', 'date', date) + selectField('Grupo', 'groupId', getGroupOptions(groupId));
  const records = db.attendance.slice().sort((a, b) => b.date.localeCompare(a.date));
  const present = db.attendance.filter(item => item.status === 'Presente').length;
  const absent = db.attendance.filter(item => item.status === 'Falta').length;
  const late = db.attendance.filter(item => item.status === 'Retardo').length;
  const listBlock = `<div class="form-group full"><label>Marca el estado de cada alumno</label><div id="attendanceStudents" class="list-stack">${attendanceStudentList(groupId, date)}</div></div>`;
  const rows = records.map(item => `<tr><td>${safeDate(item.date)}</td><td>${escapeHTML(groupName(item.groupId))}</td><td>${escapeHTML(studentName(item.studentId))}</td><td>${statusBadge(item.status)}</td><td><button class="btn btn-danger btn-small" data-action="delete" data-type="attendance" data-id="${escapeHTML(item.id)}">Eliminar</button></td></tr>`);
  return moduleHeader('Control de asistencia', 'Registra la asistencia por grupo y fecha. Puedes corregirla volviendo a guardar la misma fecha y grupo.') + `<div class="stats-grid compact-stats"><div class="stat-card"><div><strong>${present}</strong><small>Presentes</small></div></div><div class="stat-card"><div><strong>${absent}</strong><small>Faltas</small></div></div><div class="stat-card"><div><strong>${late}</strong><small>Retardos</small></div></div><div class="stat-card"><div><strong>${records.length}</strong><small>Registros</small></div></div></div>` + (db.groups.length ? formCard('Preparar lista de asistencia', 'attendanceForm', fields + listBlock, 'Guardar asistencia') : '<div class="notice">Primero registra un grupo y alumnos de ejemplo.</div>') + card('Historial de asistencia', table(['Fecha', 'Grupo', 'Alumno', 'Estado', 'Acciones'], rows));
}

/* CALIFICACIONES, TAREAS, PLANEACIONES Y EXÁMENES */
function renderGrades() {
  const fields = selectField('Alumno', 'studentId', getStudentOptions()) + field('Materia', 'subject') + field('Calificación (0 a 10)', 'score', 'number', '', true, 'min="0" max="10" step="0.1"') + field('Periodo', 'period', 'text', 'Primer periodo');
  const records = db.grades.filter(grade => !gradeFilter || grade.studentId === gradeFilter);
  const average = records.length ? (records.reduce((sum, grade) => sum + Number(grade.score), 0) / records.length).toFixed(1) : '—';
  const rows = records.map(grade => `<tr><td>${escapeHTML(studentName(grade.studentId))}</td><td>${escapeHTML(grade.subject)}</td><td><strong>${escapeHTML(grade.score)}</strong></td><td>${escapeHTML(grade.period)}</td><td>${actionButtons('grades', grade.id)}</td></tr>`);
  const filter = `<div class="toolbar"><select id="gradeFilter"><option value="">Todos los alumnos</option>${db.students.map(student => `<option value="${escapeHTML(student.id)}" ${gradeFilter === student.id ? 'selected' : ''}>${escapeHTML(student.name)}</option>`).join('')}</select><span class="muted">Promedio mostrado: <strong>${average}</strong></span></div>`;
  return moduleHeader('Calificaciones', 'Registra, modifica y consulta resultados académicos ficticios.', '<button class="btn btn-secondary" data-action="export-csv">Exportar CSV</button>') + (db.students.length ? formCard(editingRecord?.type === 'grades' ? 'Editar calificación' : 'Registrar calificación', 'gradeForm', fields, editingRecord?.type === 'grades' ? 'Actualizar calificación' : 'Guardar calificación', editingRecord?.type === 'grades' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') : '<div class="notice">Registra primero un alumno de ejemplo.</div>') + card('Calificaciones registradas', filter + table(['Alumno', 'Materia', 'Calificación', 'Periodo', 'Acciones'], rows));
}
function renderTasks() {
  const fields = field('Nombre de la tarea', 'title') + selectField('Grupo', 'groupId', getGroupOptions()) + field('Fecha de entrega', 'dueDate', 'date', todayISO()) + selectField('Estado', 'status', '<option>Pendiente</option><option>En proceso</option><option>Completada</option>') + textArea('Descripción', 'description');
  const filtered = db.tasks.filter(task => !taskFilter || task.status === taskFilter).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const rows = filtered.map(task => `<tr><td>${escapeHTML(task.title)}</td><td>${escapeHTML(groupName(task.groupId))}</td><td>${safeDate(task.dueDate)}</td><td>${statusBadge(task.status)}</td><td>${actionButtons('tasks', task.id)}</td></tr>`);
  const filter = `<div class="toolbar"><select id="taskFilter"><option value="">Todos los estados</option>${['Pendiente', 'En proceso', 'Completada'].map(value => `<option ${taskFilter === value ? 'selected' : ''}>${value}</option>`).join('')}</select><span class="muted">${filtered.length} tareas</span></div>`;
  return moduleHeader('Tareas', 'Organiza actividades, fechas de entrega y estado de avance.') + formCard(editingRecord?.type === 'tasks' ? 'Editar tarea' : 'Registrar tarea', 'taskForm', fields, editingRecord?.type === 'tasks' ? 'Actualizar tarea' : 'Guardar tarea', editingRecord?.type === 'tasks' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') + card('Lista de tareas', filter + table(['Tarea', 'Grupo', 'Entrega', 'Estado', 'Acciones'], rows));
}
function renderPlans() {
  const fields = selectField('Grupo', 'groupId', getGroupOptions()) + field('Materia', 'subject') + field('Fecha', 'date', 'date', todayISO()) + field('Tema', 'topic') + textArea('Propósito, secuencia y actividades', 'activities', '', true) + textArea('Materiales y recursos', 'materials');
  const rows = db.plans.slice().sort((a, b) => b.date.localeCompare(a.date)).map(plan => `<tr><td>${escapeHTML(plan.topic)}</td><td>${escapeHTML(plan.subject)}</td><td>${escapeHTML(groupName(plan.groupId))}</td><td>${safeDate(plan.date)}</td><td>${actionButtons('plans', plan.id)}</td></tr>`);
  return moduleHeader('Planeaciones', 'Prepara temas, propósitos, secuencias didácticas, actividades y materiales.') + formCard(editingRecord?.type === 'plans' ? 'Editar planeación' : 'Nueva planeación', 'planForm', fields, editingRecord?.type === 'plans' ? 'Actualizar planeación' : 'Guardar planeación', editingRecord?.type === 'plans' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') + card('Planeaciones guardadas', table(['Tema', 'Materia', 'Grupo', 'Fecha', 'Acciones'], rows));
}
function renderExams() {
  const fields = field('Nombre del examen', 'title') + selectField('Grupo', 'groupId', getGroupOptions()) + field('Materia', 'subject') + field('Fecha', 'date', 'date', todayISO()) + textArea('Indicaciones', 'instructions') + field('Valor total', 'points', 'number', '10', true, 'min="1" max="100"');
  const rows = db.exams.slice().sort((a, b) => a.date.localeCompare(b.date)).map(exam => `<tr><td>${escapeHTML(exam.title)}</td><td>${escapeHTML(exam.subject)}</td><td>${escapeHTML(groupName(exam.groupId))}</td><td>${safeDate(exam.date)}</td><td>${escapeHTML(exam.points || 10)}</td><td>${actionButtons('exams', exam.id)}</td></tr>`);
  return moduleHeader('Exámenes', 'Organiza evaluaciones, grupos, materias, fechas e indicaciones.') + formCard(editingRecord?.type === 'exams' ? 'Editar examen' : 'Registrar examen', 'examForm', fields, editingRecord?.type === 'exams' ? 'Actualizar examen' : 'Guardar examen', editingRecord?.type === 'exams' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') + card('Exámenes programados', table(['Examen', 'Materia', 'Grupo', 'Fecha', 'Valor', 'Acciones'], rows));
}

/* BIBLIOTECA */
function renderLibrary() {
  const fields = field('Nombre del recurso', 'title') + selectField('Tipo', 'type', '<option>Lectura</option><option>Video</option><option>Presentación</option><option>Enlace</option><option>Documento</option><option>Otro</option>') + field('Enlace (opcional)', 'url', 'url', '', false) + textArea('Descripción', 'description');
  const resources = db.resources.filter(resource =>
    (!librarySearch || `${resource.title} ${resource.description || ''}`.toLowerCase().includes(librarySearch.toLowerCase())) &&
    (!libraryFilter || resource.type === libraryFilter)
  );
  const typeCounts = ['Lectura', 'Video', 'Presentación', 'Enlace', 'Documento', 'Otro'].map(type => [type, db.resources.filter(resource => resource.type === type).length]);
  const rows = resources.map(resource => {
    const link = resource.url && /^https?:\/\//i.test(resource.url)
      ? `<a href="${escapeHTML(resource.url)}" target="_blank" rel="noopener noreferrer">Abrir recurso ↗</a>`
      : escapeHTML(resource.url || '—');
    return `<tr><td><strong>${escapeHTML(resource.title)}</strong><small class="table-subtext">${escapeHTML(resource.description || '')}</small></td><td>${escapeHTML(resource.type)}</td><td>${link}</td><td>${actionButtons('resources', resource.id)}</td></tr>`;
  });
  const stats = `<div class="resource-stats">${typeCounts.map(([type, count]) => `<div><span>${escapeHTML(type)}</span><strong>${count}</strong></div>`).join('')}</div>`;
  const controls = `<div class="toolbar"><input id="librarySearch" type="search" placeholder="Buscar recurso..." value="${escapeHTML(librarySearch)}"><select id="libraryFilter"><option value="">Todos los tipos</option>${typeCounts.map(([type]) => `<option ${libraryFilter === type ? 'selected' : ''}>${type}</option>`).join('')}</select><span class="muted">${resources.length} de ${db.resources.length} recursos</span></div>`;
  return moduleHeader('Biblioteca de recursos educativos', 'Organiza lecturas, videos, presentaciones, documentos y enlaces de apoyo.') + formCard(editingRecord?.type === 'resources' ? 'Editar recurso' : 'Agregar recurso', 'resourceForm', fields, editingRecord?.type === 'resources' ? 'Actualizar recurso' : 'Guardar recurso', editingRecord?.type === 'resources' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') + card('Estadísticas por tipo', stats) + card('Recursos guardados', controls + table(['Recurso', 'Tipo', 'Enlace', 'Acciones'], rows));
}

/* RÚBRICAS, EVALUACIONES E HISTORIAL */
function rubricCriteria(rubric) {
  if (!rubric) return [];
  return String(rubric.criteria || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}
function renderRubrics() {
  const fields = field('Nombre de la rúbrica', 'title') + textArea('Criterios de evaluación (uno por línea)', 'criteria', 'Dominio del tema\nClaridad al explicar\nOrganización de ideas\nPresentación', true) + '<div class="form-group full notice blue">Sugerencia: escribe un criterio por línea. Cada criterio se calificará de 1 a 4 durante la evaluación.</div>';
  const rows = db.rubrics.map(rubric => {
    const count = rubricCriteria(rubric).length;
    return `<tr><td><strong>${escapeHTML(rubric.title)}</strong></td><td>${count} criterios</td><td>${escapeHTML(rubricCriteria(rubric).join(' · '))}</td><td>${actionButtons('rubrics', rubric.id)}</td></tr>`;
  });
  return moduleHeader('Rúbricas', 'Crea instrumentos de evaluación con criterios claros y observables.') + formCard(editingRecord?.type === 'rubrics' ? 'Editar rúbrica' : 'Crear rúbrica', 'rubricForm', fields, editingRecord?.type === 'rubrics' ? 'Actualizar rúbrica' : 'Guardar rúbrica', editingRecord?.type === 'rubrics' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') + card('Rúbricas disponibles', table(['Nombre', 'Criterios', 'Detalle', 'Acciones'], rows));
}
function evaluationCriteriaFields(rubricId) {
  const rubric = db.rubrics.find(item => item.id === rubricId);
  if (!rubric) return '<p class="muted">Selecciona una rúbrica para cargar sus criterios.</p>';
  const criteria = rubricCriteria(rubric);
  if (!criteria.length) return '<p class="notice">Esta rúbrica no contiene criterios. Edita la rúbrica y agrega al menos uno.</p>';
  return `<div class="rubric-scale"><span><strong>4</strong> Excelente</span><span><strong>3</strong> Bueno</span><span><strong>2</strong> En proceso</span><span><strong>1</strong> Requiere apoyo</span></div>${criteria.map((criterion, index) => `<div class="criterion-row"><label for="criterion_${index}">${index + 1}. ${escapeHTML(criterion)}</label><select id="criterion_${index}" name="criterion_${index}" required><option value="4">4 · Excelente</option><option value="3">3 · Bueno</option><option value="2">2 · En proceso</option><option value="1">1 · Requiere apoyo</option></select></div>`).join('')}`;
}
function renderEvaluations() {
  const fields = selectField('Alumno', 'studentId', getStudentOptions()) + selectField('Rúbrica', 'rubricId', selectOptions(db.rubrics.map(rubric => ({ id: rubric.id, label: rubric.title })), '', 'Selecciona una rúbrica')) + `<div class="form-group full"><label>Valoración por criterio</label><div id="evaluationCriteria" class="criteria-list">${evaluationCriteriaFields('')}</div><div class="score-preview" id="evaluationScorePreview">El resultado se calculará al guardar la evaluación.</div></div>` + textArea('Observaciones', 'notes');
  const rows = db.evaluations.slice().reverse().slice(0, 8).map(evaluation => `<tr><td>${escapeHTML(studentName(evaluation.studentId))}</td><td>${escapeHTML(evaluation.rubricTitle || db.rubrics.find(r => r.id === evaluation.rubricId)?.title || 'Rúbrica')}</td><td><strong>${Number(evaluation.score || 0).toFixed(1)}/100</strong></td><td>${safeDate(evaluation.date)}</td><td><button class="btn btn-secondary btn-small" data-action="evaluation-detail" data-id="${escapeHTML(evaluation.id)}">Ver detalle</button></td></tr>`);
  const ready = db.students.length && db.rubrics.some(rubric => rubricCriteria(rubric).length);
  return moduleHeader('Evaluación con rúbricas', 'Evalúa cada criterio por separado y obtiene un resultado global automático.') + (ready ? formCard('Registrar evaluación', 'evaluationForm', fields, 'Guardar evaluación') : '<div class="notice">Para evaluar, primero registra un alumno y una rúbrica con al menos un criterio.</div>') + card('Evaluaciones recientes', table(['Alumno', 'Rúbrica', 'Resultado', 'Fecha', 'Detalle'], rows)) + renderEvaluationModal();
}
function renderHistory() {
  const rows = db.evaluations.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(evaluation => `<tr><td>${safeDate(evaluation.date)}</td><td>${escapeHTML(studentName(evaluation.studentId))}</td><td>${escapeHTML(evaluation.rubricTitle || db.rubrics.find(r => r.id === evaluation.rubricId)?.title || 'Rúbrica')}</td><td><strong>${Number(evaluation.score || 0).toFixed(1)}/100</strong></td><td>${escapeHTML(evaluation.notes || 'Sin observaciones')}</td><td><button class="btn btn-secondary btn-small" data-action="evaluation-detail" data-id="${escapeHTML(evaluation.id)}">Consulta detallada</button> <button class="btn btn-danger btn-small" data-action="delete" data-type="evaluations" data-id="${escapeHTML(evaluation.id)}">Eliminar</button></td></tr>`);
  return moduleHeader('Historial de evaluaciones', 'Consulta evaluaciones anteriores, resultados y observaciones.') + card('Historial completo', table(['Fecha', 'Alumno', 'Rúbrica', 'Resultado', 'Observaciones', 'Acciones'], rows)) + renderEvaluationModal();
}
function renderEvaluationModal() {
  if (!evaluationDetailId) return '';
  const evaluation = db.evaluations.find(item => item.id === evaluationDetailId);
  if (!evaluation) return '';
  const criteria = Array.isArray(evaluation.criterionScores) ? evaluation.criterionScores : [];
  const detailRows = criteria.map(item => `<tr><td>${escapeHTML(item.criterion)}</td><td>${escapeHTML(item.score)}</td><td>${escapeHTML(item.level || scoreLevel(item.score))}</td></tr>`);
  return `<div class="modal-backdrop" role="presentation"><section class="detail-modal" role="dialog" aria-modal="true" aria-labelledby="evaluationDetailTitle"><div class="modal-header"><div><h2 id="evaluationDetailTitle">Detalle de evaluación</h2><p>${escapeHTML(studentName(evaluation.studentId))} · ${safeDate(evaluation.date)}</p></div><button type="button" class="icon-button" data-action="close-evaluation-detail" aria-label="Cerrar">✕</button></div><div class="detail-score"><strong>${Number(evaluation.score || 0).toFixed(1)}/100</strong><span>${escapeHTML(evaluation.rubricTitle || 'Rúbrica')}</span></div>${table(['Criterio', 'Puntos', 'Nivel'], detailRows)}<p class="detail-notes"><strong>Observaciones:</strong> ${escapeHTML(evaluation.notes || 'Sin observaciones.')}</p><div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-evaluation-detail">Cerrar</button></div></section></div>`;
}
function scoreLevel(value) {
  const score = Number(value);
  return score >= 4 ? 'Excelente' : score >= 3 ? 'Bueno' : score >= 2 ? 'En proceso' : 'Requiere apoyo';
}

/* REPORTES */
function renderReports() {
  const average = db.grades.length ? (db.grades.reduce((sum, grade) => sum + Number(grade.score || 0), 0) / db.grades.length).toFixed(1) : '—';
  const present = db.attendance.filter(item => item.status === 'Presente').length;
  const absent = db.attendance.filter(item => item.status === 'Falta').length;
  const late = db.attendance.filter(item => item.status === 'Retardo').length;
  const totalAttendance = present + absent + late;
  const presentPercent = totalAttendance ? Math.round((present / totalAttendance) * 100) : 0;
  const taskDone = db.tasks.filter(task => task.status === 'Completada').length;
  const taskPercent = db.tasks.length ? Math.round((taskDone / db.tasks.length) * 100) : 0;
  const collectionRows = [
    ['Alumnos', db.students.length], ['Grupos', db.groups.length], ['Tareas', db.tasks.length],
    ['Planeaciones', db.plans.length], ['Exámenes', db.exams.length], ['Recursos', db.resources.length],
    ['Rúbricas', db.rubrics.length], ['Evaluaciones', db.evaluations.length], ['Eventos', db.events.length]
  ].map(([name, count]) => `<div class="list-item"><strong>${name}</strong><span class="badge">${count}</span></div>`);
  const attendanceBar = `<div class="report-progress"><div><span>Asistencia registrada</span><strong>${presentPercent}%</strong></div><div class="progress"><span style="width:${presentPercent}%"></span></div><small>${present} presentes · ${absent} faltas · ${late} retardos</small></div>`;
  const taskBar = `<div class="report-progress"><div><span>Tareas completadas</span><strong>${taskPercent}%</strong></div><div class="progress"><span style="width:${taskPercent}%"></span></div><small>${taskDone} de ${db.tasks.length} tareas completadas</small></div>`;
  return moduleHeader('Reportes y estadísticas', 'Consulta indicadores generales y exporta información de demostración.', '<button class="btn btn-primary" data-action="export-csv">Exportar calificaciones CSV</button> <button class="btn btn-secondary" data-action="print-report">Imprimir reporte</button>') + `<div class="stats-grid"><div class="stat-card"><div class="stat-icon">♙</div><div><strong>${db.students.length}</strong><small>Alumnos</small></div></div><div class="stat-card"><div class="stat-icon">✓</div><div><strong>${totalAttendance}</strong><small>Registros de asistencia</small></div></div><div class="stat-card"><div class="stat-icon">▤</div><div><strong>${db.grades.length}</strong><small>Calificaciones</small></div></div><div class="stat-card"><div class="stat-icon">◉</div><div><strong>${average}</strong><small>Promedio general</small></div></div></div><div class="content-grid">${card('Seguimiento de asistencia', attendanceBar)}${card('Avance de tareas', taskBar)}${card('Resumen por módulo', `<div class="list-stack">${collectionRows.join('')}</div>`)}${card('Recomendaciones de seguimiento', `<ul class="recommendation-list"><li>${db.tasks.filter(task => task.status === 'Pendiente').length} tareas pendientes de atención.</li><li>${db.evaluations.length} evaluaciones registradas con rúbrica.</li><li>${countUpcoming()} eventos próximos en el calendario.</li></ul>`)}</div>`;
}

/* USUARIOS, ASISTENTE, RESPALDOS Y CONFIGURACIÓN */
function renderUsers() {
  const fields = field('Nombre ficticio', 'name') + selectField('Rol', 'role', '<option>Administrador</option><option>Docente</option><option>Consulta</option>');
  const rows = db.users.map(user => `<tr><td>${escapeHTML(user.name)}</td><td>${escapeHTML(user.role)}</td><td>${actionButtons('users', user.id)}</td></tr>`);
  return moduleHeader('Usuarios', 'Gestiona perfiles de demostración. No representa un sistema de autenticación real.') + formCard(editingRecord?.type === 'users' ? 'Editar perfil' : 'Agregar perfil de ejemplo', 'userForm', fields, editingRecord?.type === 'users' ? 'Actualizar perfil' : 'Guardar perfil', editingRecord?.type === 'users' ? '<button class="btn btn-secondary" type="button" data-action="cancel-record-edit">Cancelar</button>' : '') + card('Perfiles registrados', table(['Nombre', 'Rol', 'Acciones'], rows)) + '<div class="notice">Los perfiles son únicamente demostrativos. No se crean contraseñas ni permisos de seguridad.</div>';
}
function renderAssistant() {
  const rows = db.assistant.slice().reverse().map(item => `<div class="list-item"><div><strong>${escapeHTML(item.title)}</strong><small>${safeDate(item.date)} · ${escapeHTML(item.category)}</small><small>${escapeHTML(item.details)}</small></div><span class="badge gray">Registrada</span></div>`).join('') || emptyState('Todavía no hay solicitudes registradas.');
  const fields = field('Título de la solicitud', 'title') + selectField('Categoría', 'category', '<option>Planeación</option><option>Actividad</option><option>Evaluación</option><option>Material didáctico</option><option>Organización</option><option>Otra</option>') + textArea('Describe lo que necesitas organizar', 'details', '', true);
  return moduleHeader('Asistente Digital Docente', 'Registra y organiza solicitudes para preparar el trabajo académico.') + '<div class="notice blue">Este módulo organiza solicitudes; no utiliza inteligencia artificial ni envía información a servicios externos.</div>' + formCard('Registrar una solicitud', 'assistantForm', fields, 'Guardar solicitud') + card('Solicitudes registradas', `<div class="list-stack">${rows}</div>`);
}
function renderBackups() {
  return moduleHeader('Respaldos y restauración', 'Descarga una copia de los datos o restaura un respaldo JSON válido.') + `<div class="content-grid"><section class="card"><h2>Crear respaldo</h2><p class="card-subtitle">Incluye todos los módulos, configuraciones y registros guardados.</p><button class="btn btn-primary" data-action="backup">Descargar respaldo JSON</button></section><section class="card"><h2>Restaurar respaldo</h2><p class="card-subtitle">Selecciona un archivo JSON generado por MaestroPro.</p><div class="form-group"><label for="restoreFile">Archivo de respaldo</label><input type="file" id="restoreFile" accept="application/json,.json"></div><button class="btn btn-secondary" data-action="restore">Restaurar archivo</button></section></div><div class="notice">La restauración reemplaza los datos actuales. Descarga primero una copia. No utilices archivos de procedencia desconocida.</div>`;
}
function renderSettings() {
  const settings = db.settings;
  const fields = field('Nombre del centro educativo', 'schoolName', 'text', settings.schoolName) + selectField('Tema de la aplicación', 'theme', `<option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Claro</option><option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Oscuro</option>`);
  return moduleHeader('Configuración', 'Personaliza el nombre del centro y la apariencia de MaestroPro.') + formCard('Preferencias generales', 'settingsForm', fields, 'Guardar configuración') + '<div class="notice">Los cambios se guardan en el almacenamiento local de este navegador.</div>' + card('Información del proyecto', '<div class="metric-lines"><div><span>Versión</span><strong>MaestroPro Escolar</strong></div><div><span>Modo de funcionamiento</span><strong>Local, sin conexión externa</strong></div><div><span>Datos</span><strong>Demostración con información ficticia</strong></div></div>');
}

/* CALENDARIO ESCOLAR */
function eventTypeClass(type) {
  return ({ Actividad: 'activity', Examen: 'exam', Reunión: 'meeting', Entrega: 'delivery', Otro: 'other' })[type] || 'other';
}
function renderCalendar() {
  const monthName = new Date(calendarYear, calendarMonth, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  let grid = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => `<div class="calendar-weekday">${day}</div>`).join('');
  for (let index = 0; index < firstDay; index++) grid += '<div class="calendar-day empty" aria-hidden="true"></div>';
  for (let day = 1; day <= totalDays; day++) {
    const date = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = db.events.filter(event => event.date === date);
    const isToday = date === todayISO();
    const dots = [...new Set(events.map(event => event.type))].map(type => `<i class="calendar-event-dot event-${eventTypeClass(type)}"></i>`).join('');
    grid += `<button type="button" class="calendar-day ${isToday ? 'today' : ''} ${date === selectedCalendarDate ? 'selected' : ''} ${events.length ? 'has-events' : ''}" data-calendar-date="${date}" title="${events.length} evento(s)" aria-pressed="${date === selectedCalendarDate}"><strong>${day}</strong>${events.length ? `<span class="calendar-event-count">${events.length}</span><span class="calendar-event-indicators">${dots}</span>` : ''}</button>`;
  }
  const dayEvents = db.events.filter(event => event.date === selectedCalendarDate).sort((a, b) => a.title.localeCompare(b.title));
  const detail = dayEvents.length ? dayEvents.map(event => `<div class="event-row"><div><span class="event-type-dot event-${eventTypeClass(event.type)}"></span><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(event.type)}${event.description ? ` · ${escapeHTML(event.description)}` : ''}</small></div><div class="inline-actions"><button class="btn btn-secondary btn-small" data-action="edit-event" data-id="${escapeHTML(event.id)}">Editar</button><button class="btn btn-danger btn-small" data-action="delete-event" data-id="${escapeHTML(event.id)}">Eliminar</button></div></div>`).join('') : '<p class="muted">No hay eventos registrados para esta fecha.</p>';
  const filtered = db.events.filter(event => (!calendarSearch || event.title.toLowerCase().includes(calendarSearch.toLowerCase())) && (!calendarFilter || event.type === calendarFilter)).sort((a, b) => a.date.localeCompare(b.date));
  const editingEvent = editingEventId ? db.events.find(event => event.id === editingEventId) : null;
  const form = `<form id="eventForm" class="form-grid"><div class="form-group"><label for="eventTitle">Nombre del evento</label><input id="eventTitle" name="title" required maxlength="100" value="${escapeHTML(editingEvent?.title || '')}" placeholder="Ej. Reunión de grupo"></div><div class="form-group"><label for="eventDate">Fecha</label><input id="eventDate" name="date" type="date" required value="${escapeHTML(editingEvent?.date || selectedCalendarDate)}"></div><div class="form-group"><label for="eventType">Tipo de evento</label><select id="eventType" name="type">${['Actividad', 'Examen', 'Reunión', 'Entrega', 'Otro'].map(type => `<option ${editingEvent?.type === type || (!editingEvent && type === 'Actividad') ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div class="form-group"><label for="eventDescription">Descripción (opcional)</label><input id="eventDescription" name="description" maxlength="180" placeholder="Detalles del evento" value="${escapeHTML(editingEvent?.description || '')}"></div><div class="form-group full form-actions"><button class="btn btn-primary" type="submit">${editingEvent ? 'Actualizar evento' : 'Guardar evento'}</button>${editingEvent ? '<button class="btn btn-secondary" type="button" data-action="cancel-event-edit">Cancelar edición</button>' : ''}</div></form>`;
  const controls = `<div class="toolbar"><input id="calendarSearch" type="search" placeholder="Buscar evento..." value="${escapeHTML(calendarSearch)}"><select id="calendarFilter"><option value="">Todos los tipos</option>${['Actividad', 'Examen', 'Reunión', 'Entrega', 'Otro'].map(type => `<option ${calendarFilter === type ? 'selected' : ''}>${type}</option>`).join('')}</select></div>`;
  const eventRows = filtered.map(event => `<tr><td>${escapeHTML(event.title)}</td><td>${safeDate(event.date)}</td><td><span class="event-type-label"><i class="event-type-dot event-${eventTypeClass(event.type)}"></i>${escapeHTML(event.type)}</span></td><td>${escapeHTML(event.description || '—')}</td><td><button class="btn btn-secondary btn-small" data-action="edit-event" data-id="${escapeHTML(event.id)}">Editar</button> <button class="btn btn-danger btn-small" data-action="delete-event" data-id="${escapeHTML(event.id)}">Eliminar</button></td></tr>`);
  return moduleHeader('Calendario escolar', 'Organiza actividades, exámenes, reuniones y entregas.') + `<div class="content-grid"><div><section class="card"><div class="calendar-navigation"><button class="btn btn-secondary" data-action="prev-month" aria-label="Mes anterior">❮</button><h3>${escapeHTML(monthName)}</h3><button class="btn btn-secondary" data-action="next-month" aria-label="Mes siguiente">❯</button></div><div class="module-actions calendar-today-action"><button class="btn btn-primary btn-small" data-action="go-today">📅 Ir a hoy</button></div><div class="monthly-grid">${grid}</div><div class="calendar-legend"><span><i class="legend-dot event-activity"></i>Actividad</span><span><i class="legend-dot event-exam"></i>Examen</span><span><i class="legend-dot event-meeting"></i>Reunión</span><span><i class="legend-dot event-delivery"></i>Entrega</span><span><i class="legend-dot event-other"></i>Otro</span></div><div class="calendar-day-detail"><h3>Eventos del ${safeDate(selectedCalendarDate)}</h3>${detail}</div></section></div><div>${card(editingEvent ? 'Editar evento' : 'Registrar evento', form)}${card('Resumen del calendario', `<div class="stats-grid mini-stats"><div class="stat-card"><strong>${db.events.length}</strong><small>Total de eventos</small></div><div class="stat-card"><strong>${countUpcoming()}</strong><small>Próximos eventos</small></div></div>`)}</div></div><section class="card"><h2>Buscar y filtrar eventos</h2>${controls}${table(['Evento', 'Fecha', 'Tipo', 'Descripción', 'Acciones'], eventRows)}</section>`;
}

function renderPage() {
  pageTitle.textContent = pageNames[currentPage] || 'MaestroPro';
  document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.page === currentPage));
  const renderers = {
    inicio: renderHome, alumnos: renderStudents, grupos: renderGroups, asistencia: renderAttendance,
    calificaciones: renderGrades, tareas: renderTasks, planeaciones: renderPlans, examenes: renderExams,
    calendario: renderCalendar, biblioteca: renderLibrary, rubricas: renderRubrics,
    evaluaciones: renderEvaluations, historial: renderHistory, reportes: renderReports,
    usuarios: renderUsers, asistente: renderAssistant, respaldos: renderBackups, configuracion: renderSettings
  };
  pageContent.innerHTML = (renderers[currentPage] || renderHome)();
  document.body.classList.toggle('theme-dark', db.settings.theme === 'dark');
  const schoolLabel = document.getElementById('schoolLabel');
  if (schoolLabel) schoolLabel.textContent = db.settings.schoolName || 'Mi centro educativo';
}
function navigateTo(page) {
  if (!pageNames[page]) return;
  currentPage = page;
  editingEventId = null;
  editingRecord = null;
  evaluationDetailId = null;
  renderPage();
  document.getElementById('sidebar')?.classList.remove('open');
}

/* GUARDADO DE FORMULARIOS */
function buildRecordFromForm(formId, data) {
  const builders = {
    studentForm: () => ['students', { name: String(data.name || '').trim(), groupId: data.groupId, status: data.status }],
    groupForm: () => ['groups', { name: String(data.name || '').trim(), subject: String(data.subject || '').trim(), teacher: String(data.teacher || '').trim() }],
    gradeForm: () => ['grades', { studentId: data.studentId, subject: String(data.subject || '').trim(), score: Number(data.score), period: String(data.period || '').trim() }],
    taskForm: () => ['tasks', { title: String(data.title || '').trim(), groupId: data.groupId, dueDate: data.dueDate, status: data.status, description: data.description || '' }],
    planForm: () => ['plans', { groupId: data.groupId, subject: String(data.subject || '').trim(), date: data.date, topic: String(data.topic || '').trim(), activities: String(data.activities || '').trim(), materials: String(data.materials || '').trim() }],
    examForm: () => ['exams', { title: String(data.title || '').trim(), groupId: data.groupId, subject: String(data.subject || '').trim(), date: data.date, instructions: data.instructions || '', points: Number(data.points || 10) }],
    resourceForm: () => ['resources', { title: String(data.title || '').trim(), type: data.type, url: data.url || '', description: data.description || '' }],
    rubricForm: () => ['rubrics', { title: String(data.title || '').trim(), criteria: String(data.criteria || '').trim() }],
    userForm: () => ['users', { name: String(data.name || '').trim(), role: data.role }],
    assistantForm: () => ['assistant', { title: String(data.title || '').trim(), category: data.category, details: String(data.details || '').trim(), date: todayISO() }]
  };
  return builders[formId] ? builders[formId]() : null;
}
function storeRecord(key, record) {
  const previousRecords = [...db[key]];
  const wasEditing = editingRecord && editingRecord.type === key;
  let message = 'Registro guardado correctamente.';

  if (wasEditing) {
    const index = db[key].findIndex(item => item.id === editingRecord.id);
    if (index >= 0) {
      db[key][index] = { ...db[key][index], ...record };
      message = 'Registro actualizado correctamente.';
    } else {
      db[key].push({ id: uid(), ...record });
    }
  } else {
    db[key].push({ id: uid(), ...record });
  }

  if (saveData()) {
    editingRecord = null;
    toast(message);
    renderPage();
  } else {
    // Revertir el cambio en memoria si el navegador no pudo guardarlo.
    db[key] = previousRecords;
  }
}
function handleSubmit(form) {
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const built = buildRecordFromForm(form.id, data);
  if (built) {
    const [key, record] = built;
    storeRecord(key, record);
    return;
  }

  if (form.id === 'attendanceForm') {
    const date = data.date;
    const groupId = data.groupId;
    const students = db.students.filter(student => student.groupId === groupId && student.status !== 'Inactivo');
    if (!students.length) { toast('No hay alumnos activos en el grupo seleccionado.'); return; }
    const previousAttendance = db.attendance;
    db.attendance = db.attendance.filter(item => !(item.date === date && item.groupId === groupId));
    students.forEach(student => db.attendance.push({
      id: uid(), date, groupId, studentId: student.id,
      status: data[`status_${student.id}`] || 'Presente'
    }));
    if (saveData()) {
      toast('Asistencia registrada correctamente.');
      renderPage();
    } else {
      db.attendance = previousAttendance;
    }
    return;
  }

  if (form.id === 'evaluationForm') {
    const rubric = db.rubrics.find(item => item.id === data.rubricId);
    const criteria = rubricCriteria(rubric);
    if (!criteria.length) { toast('La rúbrica seleccionada no contiene criterios.'); return; }
    const criterionScores = criteria.map((criterion, index) => {
      const score = Math.min(4, Math.max(1, Number(data[`criterion_${index}`] || 1)));
      return { criterion, score, level: scoreLevel(score) };
    });
    const total = criterionScores.reduce((sum, item) => sum + item.score, 0);
    const score = Math.round((total / (criterionScores.length * 4)) * 1000) / 10;
    const previousEvaluations = db.evaluations;
    db.evaluations = [...db.evaluations, {
      id: uid(), studentId: data.studentId, rubricId: rubric.id,
      rubricTitle: rubric.title, score, notes: String(data.notes || '').trim(),
      criterionScores, date: todayISO()
    }];
    if (saveData()) {
      toast('Evaluación guardada en el historial.');
      renderPage();
    } else {
      db.evaluations = previousEvaluations;
    }
    return;
  }

  if (form.id === 'settingsForm') {
    const previousSettings = { ...db.settings };
    db.settings.schoolName = String(data.schoolName || '').trim() || 'Mi centro educativo';
    db.settings.theme = data.theme === 'dark' ? 'dark' : 'light';
    if (saveData()) {
      toast('Configuración guardada.');
      renderPage();
    } else {
      db.settings = previousSettings;
    }
    return;
  }

  if (form.id === 'eventForm') {
    const record = {
      title: String(data.title || '').trim(), date: data.date,
      type: data.type || 'Actividad', description: String(data.description || '').trim()
    };
    if (!record.title || !record.date) { toast('Completa el nombre y la fecha del evento.'); return; }
    const previousEvents = JSON.parse(JSON.stringify(db.events));
    const wasEditingEvent = Boolean(editingEventId);
    if (editingEventId) {
      const event = db.events.find(item => item.id === editingEventId);
      if (event) Object.assign(event, record);
      editingEventId = null;
    } else {
      db.events.push({ id: uid(), ...record });
    }
    selectedCalendarDate = record.date;
    const date = new Date(`${record.date}T00:00:00`);
    calendarMonth = date.getMonth();
    calendarYear = date.getFullYear();
    if (saveData()) {
      toast(wasEditingEvent ? 'Evento actualizado.' : 'Evento guardado.');
      renderPage();
    } else {
      db.events = previousEvents;
      renderPage();
    }
    return;
  }
  toast('No se reconoció este formulario.');
}

/* EDICIÓN Y ELIMINACIÓN */
function removeRecord(type, id) {
  if (!Array.isArray(db[type])) return;
  const labels = {
    students: 'alumno', groups: 'grupo', attendance: 'registro de asistencia', grades: 'calificación',
    tasks: 'tarea', plans: 'planeación', exams: 'examen', resources: 'recurso', rubrics: 'rúbrica',
    users: 'perfil', evaluations: 'evaluación'
  };
  if (type === 'groups') {
    const inUse = db.students.some(item => item.groupId === id) || db.tasks.some(item => item.groupId === id) ||
      db.plans.some(item => item.groupId === id) || db.exams.some(item => item.groupId === id) || db.attendance.some(item => item.groupId === id);
    if (inUse) { toast('No se puede eliminar: el grupo tiene alumnos o registros relacionados.'); return; }
  }
  const message = type === 'students'
    ? '¿Eliminar este alumno ficticio y sus calificaciones, asistencia y evaluaciones relacionadas?'
    : type === 'rubrics' ? '¿Eliminar esta rúbrica y las evaluaciones relacionadas?'
      : `¿Deseas eliminar este ${labels[type] || 'registro'}?`;
  if (!window.confirm(message)) return;
  const previousData = JSON.parse(JSON.stringify(db));
  db[type] = db[type].filter(item => item.id !== id);
  if (editingRecord?.type === type && editingRecord.id === id) editingRecord = null;
  if (type === 'students') {
    db.grades = db.grades.filter(item => item.studentId !== id);
    db.attendance = db.attendance.filter(item => item.studentId !== id);
    db.evaluations = db.evaluations.filter(item => item.studentId !== id);
  }
  if (type === 'rubrics') db.evaluations = db.evaluations.filter(item => item.rubricId !== id);
  if (type === 'groups') {
    db.attendance = db.attendance.filter(item => item.groupId !== id);
  }
  if (saveData()) {
    toast('Registro eliminado.');
    renderPage();
  } else {
    db = previousData;
    renderPage();
  }
}
function editRecord(type, id) {
  const record = db[type]?.find(item => item.id === id);
  if (!record) { toast('No se encontró el registro.'); return; }
  const formIds = {
    students: 'studentForm', groups: 'groupForm', grades: 'gradeForm', tasks: 'taskForm',
    plans: 'planForm', exams: 'examForm', resources: 'resourceForm', rubrics: 'rubricForm', users: 'userForm'
  };
  const formId = formIds[type];
  if (!formId) { toast('La edición de este registro no está disponible en esta sección.'); return; }
  if (currentPage !== ({ students: 'alumnos', groups: 'grupos', grades: 'calificaciones', tasks: 'tareas', plans: 'planeaciones', exams: 'examenes', resources: 'biblioteca', rubrics: 'rubricas', users: 'usuarios' }[type])) {
    navigateTo(({ students: 'alumnos', groups: 'grupos', grades: 'calificaciones', tasks: 'tareas', plans: 'planeaciones', exams: 'examenes', resources: 'biblioteca', rubrics: 'rubricas', users: 'usuarios' }[type]));
  }
  editingRecord = { type, id };
  renderPage();
  const form = document.getElementById(formId);
  if (!form) { toast('No se pudo abrir el formulario de edición.'); return; }
  Object.entries(record).forEach(([key, value]) => {
    const input = form.elements.namedItem(key);
    if (input) input.value = value ?? '';
  });
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast('Datos cargados. Modifica los campos y guarda los cambios.');
}

/* RESPALDOS Y EXPORTACIÓN */
function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function createBackup() {
  const backup = { app: 'MaestroPro', version: 2, createdAt: new Date().toISOString(), ...db };
  downloadFile(`maestropro-respaldo-${todayISO()}.json`, JSON.stringify(backup, null, 2));
  toast('Respaldo descargado correctamente.');
}
function normalizeBackupPayload(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El archivo no contiene un objeto de respaldo.');
  }

  // Formato actual: exportado por MaestroPro-Nuevo.
  if (DATA_COLLECTIONS.every(key => Array.isArray(parsed[key]))) {
    return normalizeData(parsed);
  }

  // Compatibilidad: respaldos creados por la versión anterior (claves mp_*).
  const aliases = {
    students: ['mp_students'],
    groups: ['mp_groups'],
    attendance: ['mp_attendance'],
    grades: ['mp_grades'],
    tasks: ['mp_tasks'],
    plans: ['mp_plans', 'mp_planeaciones'],
    exams: ['mp_exams'],
    resources: ['mp_resources', 'mp_library'],
    rubrics: ['mp_rubrics'],
    evaluations: ['mp_evaluations'],
    events: ['mp_calendar', 'mp_events'],
    users: ['mp_users'],
    assistant: ['mp_assistant']
  };
  const migrated = {};
  let recognizedCollections = 0;

  Object.entries(aliases).forEach(([collection, keys]) => {
    if (Array.isArray(parsed[collection])) {
      migrated[collection] = parsed[collection];
      recognizedCollections++;
      return;
    }
    const legacyKey = keys.find(key => Array.isArray(parsed[key]));
    migrated[collection] = legacyKey ? parsed[legacyKey] : [];
    if (legacyKey) recognizedCollections++;
  });

  const legacySettings = parsed.mp_settings || parsed.mp_config || parsed.settings;
  migrated.settings = legacySettings && typeof legacySettings === 'object' && !Array.isArray(legacySettings)
    ? legacySettings
    : {};

  if (!recognizedCollections) throw new Error('No se reconocieron colecciones de MaestroPro.');
  return normalizeData(migrated);
}

async function restoreBackup() {
  const input = document.getElementById('restoreFile');
  const file = input?.files?.[0];
  if (!file) { toast('Selecciona primero un archivo JSON.'); return; }
  try {
    const parsed = JSON.parse(await file.text());
    const restoredData = normalizeBackupPayload(parsed);
    if (!window.confirm('La restauración reemplazará los datos actuales. ¿Deseas continuar?')) return;
    const previousData = db;
    db = restoredData;
    if (saveData()) {
      toast('Respaldo restaurado correctamente.');
      evaluationDetailId = null;
      editingRecord = null;
      editingEventId = null;
      renderPage();
    } else {
      db = previousData;
      renderPage();
    }
  } catch (error) {
    console.error('Error al restaurar el respaldo:', error);
    toast('El archivo no es un respaldo válido de MaestroPro o de su versión anterior.');
  } finally {
    if (input) input.value = '';
  }
}
function exportGradesCSV() {
  const rows = [['Alumno', 'Grupo', 'Materia', 'Calificación', 'Periodo'], ...db.grades.map(grade => [studentName(grade.studentId), groupName(db.students.find(student => student.id === grade.studentId)?.groupId), grade.subject, grade.score, grade.period])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  downloadFile(`maestropro-calificaciones-${todayISO()}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
  toast('Reporte CSV descargado.');
}

/* EVENTOS DE INTERFAZ */
function updateEvaluationCriteria() {
  const rubricId = document.getElementById('rubricId')?.value || '';
  const container = document.getElementById('evaluationCriteria');
  if (container) container.innerHTML = evaluationCriteriaFields(rubricId);
  updateEvaluationScorePreview();
}
function updateEvaluationScorePreview() {
  const selects = [...document.querySelectorAll('#evaluationCriteria select')];
  const preview = document.getElementById('evaluationScorePreview');
  if (!preview) return;
  if (!selects.length) {
    preview.textContent = 'Selecciona una rúbrica para calcular el resultado.';
    return;
  }
  const total = selects.reduce((sum, select) => sum + Number(select.value || 1), 0);
  const maximum = selects.length * 4;
  const percentage = Math.round((total / maximum) * 1000) / 10;
  preview.textContent = `Resultado estimado: ${percentage.toFixed(1)}/100 · ${total} de ${maximum} puntos.`;
}
function refreshAttendanceList() {
  const form = document.getElementById('attendanceForm');
  const groupId = form?.elements.namedItem('groupId')?.value || '';
  const date = form?.elements.namedItem('date')?.value || todayISO();
  const list = document.getElementById('attendanceStudents');
  if (list) list.innerHTML = attendanceStudentList(groupId, date);
}
function rerenderKeepingFocus() {
  const active = document.activeElement;
  const id = active?.id;
  const start = active?.selectionStart;
  const end = active?.selectionEnd;
  renderPage();
  if (id) {
    const next = document.getElementById(id);
    if (next) {
      next.focus();
      if (typeof start === 'number' && typeof end === 'number' && next.setSelectionRange) next.setSelectionRange(start, end);
    }
  }
}

pageContent.addEventListener('submit', event => {
  const form = event.target.closest('form');
  if (!form) return;
  event.preventDefault();
  try { handleSubmit(form); }
  catch (error) {
    console.error('Error al procesar el formulario:', error);
    toast('Ocurrió un problema al guardar. Revisa los campos e inténtalo nuevamente.');
  }
});

pageContent.addEventListener('click', event => {
  const dateButton = event.target.closest('[data-calendar-date]');
  if (dateButton) {
    selectedCalendarDate = dateButton.dataset.calendarDate;
    editingEventId = null;
    renderPage();
    return;
  }
  const go = event.target.closest('[data-go]');
  if (go) { navigateTo(go.dataset.go); return; }
  const actionElement = event.target.closest('[data-action]');
  if (!actionElement) return;
  const { action, type, id } = actionElement.dataset;
  if (action === 'delete') removeRecord(type, id);
  if (action === 'edit') editRecord(type, id);
  if (action === 'cancel-record-edit') { editingRecord = null; renderPage(); toast('Edición cancelada.'); }
  if (action === 'backup') createBackup();
  if (action === 'restore') restoreBackup();
  if (action === 'export-csv') exportGradesCSV();
  if (action === 'print-report') window.print();
  if (action === 'prev-month') { calendarMonth--; if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; } renderPage(); }
  if (action === 'next-month') { calendarMonth++; if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; } renderPage(); }
  if (action === 'go-today') { calendarMonth = new Date().getMonth(); calendarYear = new Date().getFullYear(); selectedCalendarDate = todayISO(); editingEventId = null; renderPage(); }
  if (action === 'edit-event') { editingEventId = id; renderPage(); }
  if (action === 'cancel-event-edit') { editingEventId = null; renderPage(); }
  if (action === 'delete-event') {
    if (window.confirm('¿Deseas eliminar este evento?')) {
      const previousEvents = db.events;
      db.events = db.events.filter(item => item.id !== id);
      if (saveData()) {
        renderPage();
        toast('Evento eliminado.');
      } else {
        db.events = previousEvents;
      }
    }
  }
  if (action === 'evaluation-detail') { evaluationDetailId = id; renderPage(); }
  if (action === 'close-evaluation-detail') { evaluationDetailId = null; renderPage(); }
});

pageContent.addEventListener('input', event => {
  if (event.target.id === 'calendarSearch') { calendarSearch = event.target.value; rerenderKeepingFocus(); }
  if (event.target.id === 'librarySearch') { librarySearch = event.target.value; rerenderKeepingFocus(); }
  if (event.target.id === 'studentSearch') { studentSearch = event.target.value; rerenderKeepingFocus(); }
});
pageContent.addEventListener('change', event => {
  if (event.target.closest('#evaluationCriteria') && event.target.matches('select')) { updateEvaluationScorePreview(); return; }
  if (event.target.id === 'calendarFilter') { calendarFilter = event.target.value; renderPage(); return; }
  if (event.target.id === 'libraryFilter') { libraryFilter = event.target.value; renderPage(); return; }
  if (event.target.id === 'studentGroupFilter') { studentGroupFilter = event.target.value; renderPage(); return; }
  if (event.target.id === 'taskFilter') { taskFilter = event.target.value; renderPage(); return; }
  if (event.target.id === 'gradeFilter') { gradeFilter = event.target.value; renderPage(); return; }
  if (event.target.id === 'rubricId') { updateEvaluationCriteria(); return; }
  if (currentPage === 'asistencia' && event.target.closest('#attendanceForm') && ['groupId', 'date'].includes(event.target.name)) refreshAttendanceList();
});

document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => navigateTo(button.dataset.page)));
document.getElementById('menuToggle')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));
document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

renderPage();
