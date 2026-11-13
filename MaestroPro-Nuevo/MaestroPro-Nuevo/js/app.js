'use strict';

const STORAGE_KEY = 'maestropro_demo_v1';
const pageContent = document.getElementById('pageContent');
const pageTitle = document.getElementById('pageTitle');
const toastRegion = document.getElementById('toastRegion');

const pageNames = {
  inicio: 'Inicio', alumnos: 'Alumnos', grupos: 'Grupos y materias', asistencia: 'Control de asistencia',
  calificaciones: 'Calificaciones', tareas: 'Tareas', planeaciones: 'Planeaciones', examenes: 'Exámenes',
  calendario: 'Calendario escolar', biblioteca: 'Biblioteca', rubricas: 'Rúbricas', evaluaciones: 'Evaluaciones',
  historial: 'Historial de evaluaciones', reportes: 'Reportes', usuarios: 'Usuarios', asistente: 'Asistente Digital Docente',
  respaldos: 'Respaldos y restauración', configuracion: 'Configuración'
};

function uid() { return `${Date.now()}${Math.floor(Math.random() * 1000)}`; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function safeDate(value) { if (!value) return 'Sin fecha'; const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}); }
function seedData() {
  const groupId = 'g-demo-1';
  return {
    students: [
      {id:'s-demo-1',name:'Alumno de ejemplo 1',groupId,status:'Activo'},
      {id:'s-demo-2',name:'Alumno de ejemplo 2',groupId,status:'Activo'},
      {id:'s-demo-3',name:'Alumno de ejemplo 3',groupId,status:'Activo'}
    ],
    groups: [{id:groupId,name:'1.º A',subject:'Formación general',teacher:'Docente de ejemplo'}],
    attendance: [], grades: [],
    tasks: [{id:'t-demo-1',title:'Actividad de repaso',groupId,dueDate:todayISO(),status:'Pendiente'}],
    plans: [], exams: [], resources: [], rubrics: [], evaluations: [], events: [],
    users: [{id:'u-demo-1',name:'Docente de demostración',role:'Administrador'}],
    assistant: [], settings: {schoolName:'Mi centro educativo',theme:'light'}
  };
}
function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') return {...seedData(), ...saved, settings:{...seedData().settings,...(saved.settings||{})}};
  } catch (error) { console.warn('No se pudieron leer los datos locales:', error); }
  return seedData();
}
let db = loadData();
let currentPage = 'inicio';
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let selectedCalendarDate = todayISO();
let calendarSearch = '';
let calendarFilter = '';
let editingEventId = null;
let editingRecord = null;

function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
  catch (error) { toast('No se pudo guardar. Revisa el espacio disponible del navegador.', 'error'); }
}
function toast(message) {
  const item = document.createElement('div'); item.className = 'toast'; item.textContent = message;
  toastRegion.appendChild(item); setTimeout(() => item.remove(), 3000);
}
function groupName(id) { return db.groups.find(x=>x.id===id)?.name || 'Sin grupo'; }
function studentName(id) { return db.students.find(x=>x.id===id)?.name || 'Alumno no disponible'; }
function selectOptions(items, selected, emptyLabel='Selecciona una opción') {
  return `<option value="">${emptyLabel}</option>` + items.map(x=>`<option value="${escapeHTML(x.id)}" ${x.id===selected?'selected':''}>${escapeHTML(x.label)}</option>`).join('');
}
function moduleHeader(title, description, action='') {
  return `<div class="module-header"><div><h2>${title}</h2><p>${description}</p></div>${action ? `<div class="module-actions">${action}</div>` : ''}</div>`;
}
function card(title, content, subtitle='') { return `<section class="card"><h2>${title}</h2>${subtitle?`<p class="card-subtitle">${subtitle}</p>`:''}${content}</section>`; }
function emptyState(text) { return `<div class="empty-state">${text}</div>`; }
function actionButtons(type,id) { return `<button class="btn btn-secondary btn-small" data-action="edit" data-type="${type}" data-id="${id}">Editar</button> <button class="btn btn-danger btn-small" data-action="delete" data-type="${type}" data-id="${id}">Eliminar</button>`; }
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}">${emptyState('Todavía no hay registros.')}</td></tr>`}</tbody></table></div>`; }
function field(label,name,type='text',value='',required=true,extra='') {
  return `<div class="form-group"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHTML(value)}" ${required?'required':''} ${extra}></div>`;
}
function selectField(label,name,options,required=true) { return `<div class="form-group"><label for="${name}">${label}</label><select id="${name}" name="${name}" ${required?'required':''}>${options}</select></div>`; }
function textArea(label,name,value='',required=false) { return `<div class="form-group full"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" ${required?'required':''}>${escapeHTML(value)}</textarea></div>`; }
function formCard(title,formId,fields,submit='Guardar registro',extra='') {
  return `<section class="card"><h2>${title}</h2><form id="${formId}" class="form-grid" autocomplete="off">${fields}<div class="form-group full form-actions"><button class="btn btn-primary" type="submit">${submit}</button>${extra}</div></form></section>`;
}
function getGroupOptions(selected='') { return selectOptions(db.groups.map(x=>({id:x.id,label:x.name})),selected,'Selecciona un grupo'); }
function getStudentOptions(selected='') { return selectOptions(db.students.map(x=>({id:x.id,label:x.name})),selected,'Selecciona un alumno'); }
function countUpcoming() { return db.events.filter(e=>e.date>=todayISO()).length; }

function renderHome() {
  const pending = db.tasks.filter(x=>x.status!=='Completada').length;
  return `<div class="welcome"><div><h2>¡Bienvenido a MaestroPro!</h2><p>Organiza tus actividades académicas desde un solo lugar. Administra grupos, seguimiento escolar, recursos y calendario con una interfaz sencilla.</p></div><div class="welcome-mark">✦</div></div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-icon">♙</div><div><strong>${db.students.length}</strong><small>Alumnos registrados</small></div></div>
    <div class="stat-card"><div class="stat-icon">▦</div><div><strong>${db.groups.length}</strong><small>Grupos y materias</small></div></div>
    <div class="stat-card"><div class="stat-icon">✎</div><div><strong>${pending}</strong><small>Tareas pendientes</small></div></div>
    <div class="stat-card"><div class="stat-icon">▣</div><div><strong>${countUpcoming()}</strong><small>Próximos eventos</small></div></div>
  </div>
  <div class="content-grid">
    ${card('Accesos rápidos',`<div class="quick-actions"><button class="quick-action" data-go="alumnos">♙<strong>Alumnos</strong><small>Consultar registros</small></button><button class="quick-action" data-go="asistencia">✓<strong>Asistencia</strong><small>Registrar seguimiento</small></button><button class="quick-action" data-go="planeaciones">▧<strong>Planeaciones</strong><small>Organizar clases</small></button><button class="quick-action" data-go="calendario">▦<strong>Calendario</strong><small>Ver actividades</small></button></div>`)}
    ${card('Próximos eventos',db.events.filter(e=>e.date>=todayISO()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5).map(e=>`<div class="list-item"><div><strong>${escapeHTML(e.title)}</strong><small>${safeDate(e.date)} · ${escapeHTML(e.type)}</small></div><span class="badge">${escapeHTML(e.type)}</span></div>`).join('')||emptyState('No hay eventos próximos. Agrega uno desde el calendario.'))}
  </div><div class="notice blue">Este proyecto funciona localmente en el navegador. Utiliza únicamente información ficticia para demostraciones; no ingreses nombres, datos de contacto, calificaciones reales ni información privada de estudiantes.</div>`;
}

function renderStudents() {
  const fields = field('Nombre de demostración','name') + selectField('Grupo','groupId',getGroupOptions()) + selectField('Estado','status','<option>Activo</option><option>Inactivo</option>');
  const rows = db.students.map(s=>`<tr><td>${escapeHTML(s.name)}</td><td>${escapeHTML(groupName(s.groupId))}</td><td><span class="badge ${s.status==='Activo'?'green':'gray'}">${escapeHTML(s.status)}</span></td><td>${actionButtons('students',s.id)}</td></tr>`);
  return moduleHeader('Alumnos','Registra y organiza alumnos de ejemplo para demostrar el funcionamiento.') + `<div class="notice">Usa nombres ficticios. Esta versión no cuenta con autenticación ni protección de datos para uso institucional real.</div>` + formCard('Registrar alumno','studentForm',fields) + card('Lista de alumnos',table(['Nombre','Grupo','Estado','Acciones'],rows));
}
function renderGroups() {
  const fields = field('Nombre del grupo','name')+field('Materia o área','subject')+field('Docente (nombre ficticio)','teacher');
  const rows = db.groups.map(g=>`<tr><td>${escapeHTML(g.name)}</td><td>${escapeHTML(g.subject)}</td><td>${escapeHTML(g.teacher)}</td><td>${db.students.filter(s=>s.groupId===g.id).length}</td><td>${actionButtons('groups',g.id)}</td></tr>`);
  return moduleHeader('Grupos y materias','Administra los grupos y las asignaturas del proyecto.')+formCard('Registrar grupo o materia','groupForm',fields)+card('Grupos registrados',table(['Grupo','Materia','Docente','Alumnos','Acciones'],rows));
}
function renderAttendance() {
  const groupId = db.groups[0]?.id || '';
  const fields = field('Fecha','date', 'date',todayISO())+selectField('Grupo','groupId',getGroupOptions(groupId));
  const rows = db.attendance.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(a=>`<tr><td>${safeDate(a.date)}</td><td>${escapeHTML(groupName(a.groupId))}</td><td>${escapeHTML(studentName(a.studentId))}</td><td><span class="badge ${a.status==='Presente'?'green':a.status==='Falta'?'red':'orange'}">${escapeHTML(a.status)}</span></td><td><button class="btn btn-danger btn-small" data-action="delete" data-type="attendance" data-id="${a.id}">Eliminar</button></td></tr>`);
  return moduleHeader('Control de asistencia','Registra la asistencia de un grupo utilizando datos de demostración.') + (db.groups.length?formCard('Preparar lista de asistencia','attendanceForm',fields+`<div class="form-group full"><label>Marca el estado de cada alumno</label><div id="attendanceStudents" class="list-stack">${db.students.filter(s=>s.groupId===groupId).map(s=>`<div class="list-item"><strong>${escapeHTML(s.name)}</strong><select name="status_${s.id}" aria-label="Estado de ${escapeHTML(s.name)}"><option>Presente</option><option>Falta</option><option>Retardo</option></select></div>`).join('')||emptyState('No hay alumnos de demostración en este grupo.')}</div></div>`,'Guardar asistencia'):`<div class="notice">Primero registra un grupo y alumnos para preparar una lista de asistencia.</div>`) + card('Registros recientes',table(['Fecha','Grupo','Alumno','Estado','Acciones'],rows));
}
function renderGrades() {
  const fields = selectField('Alumno','studentId',getStudentOptions())+field('Materia','subject')+field('Calificación (0 a 10)','score','number','',true,'min="0" max="10" step="0.1"')+field('Periodo','period','text','Primer periodo');
  const rows = db.grades.map(g=>`<tr><td>${escapeHTML(studentName(g.studentId))}</td><td>${escapeHTML(g.subject)}</td><td><strong>${escapeHTML(g.score)}</strong></td><td>${escapeHTML(g.period)}</td><td>${actionButtons('grades',g.id)}</td></tr>`);
  return moduleHeader('Calificaciones','Registra resultados académicos ficticios y consulta los registros.')+(db.students.length?formCard('Registrar calificación','gradeForm',fields):'<div class="notice">Registra primero un alumno de ejemplo.</div>')+card('Calificaciones registradas',table(['Alumno','Materia','Calificación','Periodo','Acciones'],rows));
}
function renderTasks() {
  const fields = field('Nombre de la tarea','title')+selectField('Grupo','groupId',getGroupOptions())+field('Fecha de entrega','dueDate','date',todayISO())+selectField('Estado','status','<option>Pendiente</option><option>En proceso</option><option>Completada</option>')+textArea('Descripción','description');
  const rows = db.tasks.map(t=>`<tr><td>${escapeHTML(t.title)}</td><td>${escapeHTML(groupName(t.groupId))}</td><td>${safeDate(t.dueDate)}</td><td><span class="badge ${t.status==='Completada'?'green':t.status==='En proceso'?'orange':'gray'}">${escapeHTML(t.status)}</span></td><td>${actionButtons('tasks',t.id)}</td></tr>`);
  return moduleHeader('Tareas','Organiza actividades y fechas de entrega.')+formCard('Registrar tarea','taskForm',fields)+card('Lista de tareas',table(['Tarea','Grupo','Entrega','Estado','Acciones'],rows));
}
function renderPlans() {
  const fields = selectField('Grupo','groupId',getGroupOptions())+field('Materia','subject')+field('Fecha','date','date',todayISO())+field('Tema','topic')+textArea('Propósito y actividades','activities', '',true);
  const rows = db.plans.map(p=>`<tr><td>${escapeHTML(p.topic)}</td><td>${escapeHTML(p.subject)}</td><td>${escapeHTML(groupName(p.groupId))}</td><td>${safeDate(p.date)}</td><td>${actionButtons('plans',p.id)}</td></tr>`);
  return moduleHeader('Planeaciones','Prepara temas, propósitos y actividades para tus clases.')+formCard('Nueva planeación','planForm',fields)+card('Planeaciones guardadas',table(['Tema','Materia','Grupo','Fecha','Acciones'],rows));
}
function renderExams() {
  const fields = field('Nombre del examen','title')+selectField('Grupo','groupId',getGroupOptions())+field('Materia','subject')+field('Fecha','date','date',todayISO())+textArea('Indicaciones','instructions');
  const rows = db.exams.map(e=>`<tr><td>${escapeHTML(e.title)}</td><td>${escapeHTML(e.subject)}</td><td>${escapeHTML(groupName(e.groupId))}</td><td>${safeDate(e.date)}</td><td>${actionButtons('exams',e.id)}</td></tr>`);
  return moduleHeader('Exámenes','Organiza evaluaciones y fechas de aplicación.')+formCard('Registrar examen','examForm',fields)+card('Exámenes programados',table(['Examen','Materia','Grupo','Fecha','Acciones'],rows));
}
function renderLibrary() {
  const fields = field('Nombre del recurso','title')+selectField('Tipo','type','<option>Lectura</option><option>Video</option><option>Presentación</option><option>Enlace</option><option>Otro</option>')+field('Enlace (opcional)','url','url','',false)+textArea('Descripción','description');
  const rows = db.resources.map(r=>`<tr><td>${escapeHTML(r.title)}</td><td>${escapeHTML(r.type)}</td><td>${r.url && /^https?:\/\//i.test(r.url)?`<a href="${escapeHTML(r.url)}" target="_blank" rel="noopener noreferrer">Abrir recurso ↗</a>`:escapeHTML(r.url||'—')}</td><td>${actionButtons('resources',r.id)}</td></tr>`);
  return moduleHeader('Biblioteca de recursos educativos','Guarda recursos y enlaces de apoyo para las clases.')+formCard('Agregar recurso','resourceForm',fields)+card('Recursos guardados',table(['Recurso','Tipo','Enlace','Acciones'],rows));
}
function renderRubrics() {
  const fields = field('Nombre de la rúbrica','title')+textArea('Criterios de evaluación (uno por línea)','criteria','Claridad\nDominio del tema\nPresentación',true);
  const rows = db.rubrics.map(r=>`<tr><td>${escapeHTML(r.title)}</td><td>${escapeHTML(r.criteria.split('\n').filter(Boolean).length)} criterios</td><td>${actionButtons('rubrics',r.id)}</td></tr>`);
  return moduleHeader('Rúbricas','Define criterios para valorar trabajos y actividades.')+formCard('Crear rúbrica','rubricForm',fields)+card('Rúbricas disponibles',table(['Nombre','Criterios','Acciones'],rows));
}
function renderEvaluations() {
  const rubricOptions = selectOptions(db.rubrics.map(r=>({id:r.id,label:r.title})),'','Selecciona una rúbrica');
  const fields = selectField('Alumno','studentId',getStudentOptions())+selectField('Rúbrica','rubricId',rubricOptions)+field('Puntuación (0 a 100)','score','number','',true,'min="0" max="100"')+textArea('Observaciones','notes');
  const rows = db.evaluations.slice().reverse().map(e=>`<tr><td>${escapeHTML(studentName(e.studentId))}</td><td>${escapeHTML(db.rubrics.find(r=>r.id===e.rubricId)?.title||'Rúbrica eliminada')}</td><td>${escapeHTML(e.score)}/100</td><td>${safeDate(e.date)}</td></tr>`);
  return moduleHeader('Evaluación con rúbricas','Registra una evaluación de demostración basada en criterios.')+(db.students.length&&db.rubrics.length?formCard('Registrar evaluación','evaluationForm',fields):'<div class="notice">Para evaluar, primero registra un alumno y crea una rúbrica.</div>')+card('Evaluaciones recientes',table(['Alumno','Rúbrica','Puntuación','Fecha'],rows));
}
function renderHistory() {
  const rows = db.evaluations.slice().reverse().map(e=>`<tr><td>${safeDate(e.date)}</td><td>${escapeHTML(studentName(e.studentId))}</td><td>${escapeHTML(db.rubrics.find(r=>r.id===e.rubricId)?.title||'Rúbrica eliminada')}</td><td>${escapeHTML(e.score)}/100</td><td>${escapeHTML(e.notes||'Sin observaciones')}</td></tr>`);
  return moduleHeader('Historial de evaluaciones','Consulta los registros de evaluación realizados.')+card('Historial',table(['Fecha','Alumno','Rúbrica','Resultado','Observaciones'],rows));
}
function renderReports() {
  const average = db.grades.length ? (db.grades.reduce((n,g)=>n+Number(g.score||0),0)/db.grades.length).toFixed(1) : '—';
  const attendanceCount = db.attendance.length;
  return moduleHeader('Reportes','Resumen general de la información de demostración.', '<button class="btn btn-primary" data-action="export-csv">Exportar calificaciones CSV</button>')+`<div class="stats-grid"><div class="stat-card"><div class="stat-icon">♙</div><div><strong>${db.students.length}</strong><small>Alumnos de ejemplo</small></div></div><div class="stat-card"><div class="stat-icon">✓</div><div><strong>${attendanceCount}</strong><small>Registros de asistencia</small></div></div><div class="stat-card"><div class="stat-icon">▤</div><div><strong>${db.grades.length}</strong><small>Calificaciones</small></div></div><div class="stat-card"><div class="stat-icon">◉</div><div><strong>${average}</strong><small>Promedio registrado</small></div></div></div>`+card('Resumen de módulos',`<div class="list-stack">${[['Grupos',db.groups.length],['Tareas',db.tasks.length],['Planeaciones',db.plans.length],['Exámenes',db.exams.length],['Recursos',db.resources.length],['Rúbricas',db.rubrics.length],['Eventos',db.events.length]].map(([n,v])=>`<div><div class="list-item"><strong>${n}</strong><span class="badge">${v}</span></div></div>`).join('')}</div>`);
}
function renderUsers() {
  const fields = field('Nombre ficticio','name')+selectField('Rol','role','<option>Administrador</option><option>Docente</option><option>Consulta</option>');
  const rows = db.users.map(u=>`<tr><td>${escapeHTML(u.name)}</td><td>${escapeHTML(u.role)}</td><td>${actionButtons('users',u.id)}</td></tr>`);
  return moduleHeader('Usuarios','Gestiona perfiles de demostración. Esta pantalla no implementa inicio de sesión real.')+formCard('Agregar perfil de ejemplo','userForm',fields)+card('Perfiles registrados',table(['Nombre','Rol','Acciones'],rows));
}
function renderAssistant() {
  const rows = db.assistant.slice().reverse().map(a=>`<div class="list-item"><div><strong>${escapeHTML(a.title)}</strong><small>${safeDate(a.date)} · ${escapeHTML(a.category)}</small><small>${escapeHTML(a.details)}</small></div><span class="badge gray">Registrada</span></div>`).join('')||emptyState('Todavía no hay solicitudes registradas.');
  return moduleHeader('Asistente Digital Docente','Organiza solicitudes e ideas de trabajo en un solo lugar.')+`<div class="notice blue">Este módulo funciona como organizador de solicitudes. No utiliza inteligencia artificial ni envía información a servicios externos.</div>`+formCard('Registrar una solicitud','assistantForm',field('Título','title')+selectField('Categoría','category','<option>Planeación</option><option>Actividad</option><option>Evaluación</option><option>Material didáctico</option><option>Otra</option>')+textArea('Describe lo que necesitas organizar','details', '',true),'Guardar solicitud')+card('Solicitudes registradas',`<div class="list-stack">${rows}</div>`);
}
function renderBackups() {
  return moduleHeader('Respaldos y restauración','Descarga una copia de los datos de demostración o restaura un archivo JSON.')+`<div class="content-grid"><section class="card"><h2>Crear respaldo</h2><p class="card-subtitle">Descarga los registros guardados en este navegador.</p><button class="btn btn-primary" data-action="backup">Descargar respaldo JSON</button></section><section class="card"><h2>Restaurar respaldo</h2><p class="card-subtitle">Selecciona un respaldo JSON creado desde MaestroPro.</p><div class="form-group"><label for="restoreFile">Archivo de respaldo</label><input type="file" id="restoreFile" accept="application/json,.json"></div><button class="btn btn-secondary" data-action="restore">Restaurar archivo</button></section></div><div class="notice">La restauración reemplaza los datos actuales. Haz una copia antes de restaurar. No uses archivos de procedencia desconocida.</div>`;
}
function renderSettings() {
  const settings = db.settings;
  return moduleHeader('Configuración','Personaliza el nombre del centro y la apariencia de la aplicación.')+formCard('Preferencias generales','settingsForm',field('Nombre del centro educativo','schoolName','text',settings.schoolName)+selectField('Tema de la aplicación','theme',`<option value="light" ${settings.theme==='light'?'selected':''}>Claro</option><option value="dark" ${settings.theme==='dark'?'selected':''}>Oscuro</option>`),'Guardar configuración')+`<div class="notice">Los cambios se guardan en el almacenamiento local del navegador de este equipo.</div>`;
}

function eventTypeClass(type) { return ({Actividad:'activity',Examen:'exam',Reunión:'meeting',Entrega:'delivery',Otro:'other'})[type] || 'other'; }
function renderCalendar() {
  const monthName = new Date(calendarYear,calendarMonth,1).toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  const firstDay = new Date(calendarYear,calendarMonth,1).getDay();
  const totalDays = new Date(calendarYear,calendarMonth+1,0).getDate();
  let grid = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d=>`<div class="calendar-weekday">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++) grid += '<div class="calendar-day empty"></div>';
  for(let day=1;day<=totalDays;day++) {
    const date = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const events = db.events.filter(e=>e.date===date);
    const today = date===todayISO();
    grid += `<button type="button" class="calendar-day ${today?'today':''} ${date===selectedCalendarDate?'selected':''} ${events.length?'has-events':''}" data-calendar-date="${date}" title="${events.length} evento(s)"><strong>${day}</strong>${events.length?`<span class="calendar-event-count">${events.length}</span><span class="calendar-event-indicators">${[...new Set(events.map(e=>e.type))].map(t=>`<i class="calendar-event-dot event-${eventTypeClass(t)}"></i>`).join('')}</span>`:''}</button>`;
  }
  const selectedEvents = db.events.filter(e=>e.date===selectedCalendarDate);
  const detail = selectedEvents.length ? selectedEvents.map(e=>`<div class="event-row"><div><i class="event-type-dot event-${eventTypeClass(e.type)}"></i><strong>${escapeHTML(e.title)}</strong><div class="muted">${escapeHTML(e.type)}</div></div><div class="module-actions"><button class="btn btn-secondary btn-small" data-action="edit-event" data-id="${e.id}">Editar</button><button class="btn btn-danger btn-small" data-action="delete-event" data-id="${e.id}">Eliminar</button></div></div>`).join('') : '<p class="muted">No hay eventos registrados para esta fecha.</p>';
  const filtered = db.events.filter(e=>(!calendarSearch||e.title.toLowerCase().includes(calendarSearch.toLowerCase()))&&(!calendarFilter||e.type===calendarFilter)).sort((a,b)=>a.date.localeCompare(b.date));
  const form = `<form id="eventForm" class="form-grid"><div class="form-group"><label for="eventTitle">Nombre del evento</label><input id="eventTitle" name="title" required value="${editingEventId?escapeHTML(db.events.find(e=>e.id===editingEventId)?.title||''):''}" placeholder="Ej. Reunión de grupo"></div><div class="form-group"><label for="eventDate">Fecha</label><input id="eventDate" name="date" type="date" required value="${editingEventId?escapeHTML(db.events.find(e=>e.id===editingEventId)?.date||selectedCalendarDate):selectedCalendarDate}"></div><div class="form-group"><label for="eventType">Tipo de evento</label><select id="eventType" name="type"><option>Actividad</option><option>Examen</option><option>Reunión</option><option>Entrega</option><option>Otro</option></select></div><div class="form-group"><label for="eventDescription">Descripción (opcional)</label><input id="eventDescription" name="description" placeholder="Detalles del evento" value="${editingEventId?escapeHTML(db.events.find(e=>e.id===editingEventId)?.description||''):''}"></div><div class="form-group full form-actions"><button class="btn btn-primary" type="submit">${editingEventId?'Actualizar evento':'Guardar evento'}</button>${editingEventId?'<button class="btn btn-secondary" type="button" data-action="cancel-event-edit">Cancelar edición</button>':''}</div></form>`;
  return moduleHeader('Calendario escolar','Organiza actividades, exámenes, reuniones y entregas.')+`<div class="content-grid"><div><section class="card"><div class="calendar-navigation"><button class="btn btn-secondary" data-action="prev-month" aria-label="Mes anterior">❮</button><h3>${monthName}</h3><button class="btn btn-secondary" data-action="next-month" aria-label="Mes siguiente">❯</button></div><div class="module-actions" style="margin-bottom:12px"><button class="btn btn-primary btn-small" data-action="go-today">📅 Ir a hoy</button></div><div class="monthly-grid">${grid}</div><div class="calendar-legend"><span><i class="legend-dot event-activity"></i>Actividad</span><span><i class="legend-dot event-exam"></i>Examen</span><span><i class="legend-dot event-meeting"></i>Reunión</span><span><i class="legend-dot event-delivery"></i>Entrega</span><span><i class="legend-dot event-other"></i>Otro</span></div><div class="calendar-day-detail"><h3>Eventos del ${safeDate(selectedCalendarDate)}</h3>${detail}</div></section></div><div>${card(editingEventId?'Editar evento':'Registrar evento',form)}${card('Resumen del calendario',`<div class="stats-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><strong>${db.events.length}</strong><small class="muted">Total de eventos</small></div><div><strong>${countUpcoming()}</strong><small class="muted">Próximos eventos</small></div></div>`)}</div></div><section class="card"><h2>Buscar y filtrar eventos</h2><div class="toolbar"><input id="calendarSearch" type="search" placeholder="Buscar por nombre..." value="${escapeHTML(calendarSearch)}"><select id="calendarFilter"><option value="">Todos los tipos</option>${['Actividad','Examen','Reunión','Entrega','Otro'].map(t=>`<option ${calendarFilter===t?'selected':''}>${t}</option>`).join('')}</select></div>${table(['Evento','Fecha','Tipo','Descripción','Acciones'],filtered.map(e=>`<tr><td>${escapeHTML(e.title)}</td><td>${safeDate(e.date)}</td><td><span class="badge">${escapeHTML(e.type)}</span></td><td>${escapeHTML(e.description||'—')}</td><td><button class="btn btn-secondary btn-small" data-action="edit-event" data-id="${e.id}">Editar</button> <button class="btn btn-danger btn-small" data-action="delete-event" data-id="${e.id}">Eliminar</button></td></tr>`))}</section>`;
}

function renderPage() {
  pageTitle.textContent = pageNames[currentPage] || 'MaestroPro';
  document.querySelectorAll('.nav-link').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===currentPage));
  const renderers = {inicio:renderHome,alumnos:renderStudents,grupos:renderGroups,asistencia:renderAttendance,calificaciones:renderGrades,tareas:renderTasks,planeaciones:renderPlans,examenes:renderExams,calendario:renderCalendar,biblioteca:renderLibrary,rubricas:renderRubrics,evaluaciones:renderEvaluations,historial:renderHistory,reportes:renderReports,usuarios:renderUsers,asistente:renderAssistant,respaldos:renderBackups,configuracion:renderSettings};
  pageContent.innerHTML = (renderers[currentPage] || renderHome)();
  document.body.classList.toggle('theme-dark',db.settings.theme==='dark');
  if(currentPage==='calendario') { const typeSelect=document.getElementById('eventType'); if(typeSelect) typeSelect.value=editingEventId ? (db.events.find(e=>e.id===editingEventId)?.type || 'Actividad') : 'Actividad'; }
}
function navigateTo(page) { if(!pageNames[page]) return; currentPage=page; editingEventId=null; editingRecord=null; renderPage(); document.getElementById('sidebar').classList.remove('open'); }

function handleSubmit(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const id = uid();
  const map = {
    studentForm: ['students',{name:data.name.trim(),groupId:data.groupId,status:data.status}],
    groupForm: ['groups',{name:data.name.trim(),subject:data.subject.trim(),teacher:data.teacher.trim()}],
    gradeForm: ['grades',{studentId:data.studentId,subject:data.subject.trim(),score:Number(data.score),period:data.period.trim()}],
    taskForm: ['tasks',{title:data.title.trim(),groupId:data.groupId,dueDate:data.dueDate,status:data.status,description:data.description||''}],
    planForm: ['plans',{groupId:data.groupId,subject:data.subject.trim(),date:data.date,topic:data.topic.trim(),activities:data.activities.trim()}],
    examForm: ['exams',{title:data.title.trim(),groupId:data.groupId,subject:data.subject.trim(),date:data.date,instructions:data.instructions||''}],
    resourceForm: ['resources',{title:data.title.trim(),type:data.type,url:data.url||'',description:data.description||''}],
    rubricForm: ['rubrics',{title:data.title.trim(),criteria:data.criteria.trim()}],
    userForm: ['users',{name:data.name.trim(),role:data.role}],
    assistantForm: ['assistant',{title:data.title.trim(),category:data.category,details:data.details.trim(),date:todayISO()}]
  };
  if(map[form.id]) {
    const [key,record]=map[form.id];
    if(editingRecord && editingRecord.type===key) {
      const index=db[key].findIndex(item=>item.id===editingRecord.id);
      if(index>=0) db[key][index]={...db[key][index],...record};
      editingRecord=null;
      toast('Registro actualizado correctamente.');
    } else {
      db[key].push({id,...record});
      toast('Registro guardado correctamente.');
    }
    saveData(); renderPage(); return;
  }
  if(form.id==='attendanceForm') {
    const date=data.date; const groupId=data.groupId;
    const students=db.students.filter(s=>s.groupId===groupId);
    students.forEach(s=>{db.attendance.push({id:uid(),date,groupId,studentId:s.id,status:data[`status_${s.id}`]||'Presente'});});
    saveData(); toast('Asistencia registrada.'); renderPage(); return;
  }
  if(form.id==='evaluationForm') {
    const record={id,studentId:data.studentId,rubricId:data.rubricId,score:Number(data.score),notes:data.notes||'',date:todayISO()};
    db.evaluations.push(record); saveData(); toast('Evaluación guardada en el historial.'); renderPage(); return;
  }
  if(form.id==='settingsForm') {
    db.settings.schoolName=data.schoolName.trim()||'Mi centro educativo'; db.settings.theme=data.theme; saveData(); toast('Configuración guardada.'); renderPage(); return;
  }
  if(form.id==='eventForm') {
    const typeSelect=form.querySelector('[name="type"]');
    const record={title:data.title.trim(),date:data.date,type:typeSelect.value,description:data.description||''};
    if(editingEventId) { const event=db.events.find(e=>e.id===editingEventId); if(event) Object.assign(event,record); editingEventId=null; toast('Evento actualizado.'); }
    else {db.events.push({id,...record}); toast('Evento guardado.');}
    selectedCalendarDate=record.date; const d=new Date(`${record.date}T00:00:00`); calendarMonth=d.getMonth(); calendarYear=d.getFullYear(); saveData(); renderPage(); return;
  }
}
function removeRecord(type,id) {
  const labels={students:'alumno',groups:'grupo',attendance:'registro de asistencia',grades:'calificación',tasks:'tarea',plans:'planeación',exams:'examen',resources:'recurso',rubrics:'rúbrica',users:'perfil'};
  if(!Array.isArray(db[type])) return;
  if(!confirm(`¿Deseas eliminar este ${labels[type]||'registro'}?`)) return;
  db[type]=db[type].filter(x=>x.id!==id); saveData(); toast('Registro eliminado.'); renderPage();
}
function editRecord(type,id) {
  const rec=db[type]?.find(x=>x.id===id); if(!rec){toast('No se encontró el registro.');return;}
  const formIds={students:'studentForm',groups:'groupForm',grades:'gradeForm',tasks:'taskForm',plans:'planForm',exams:'examForm',resources:'resourceForm',rubrics:'rubricForm',users:'userForm'};
  const form=document.getElementById(formIds[type]); if(!form){toast('La edición de este registro no está disponible en esta vista.');return;}
  editingRecord={type,id};
  Object.entries(rec).forEach(([key,value])=>{const input=form.elements.namedItem(key);if(input)input.value=value;});
  const submit=form.querySelector('button[type="submit"]'); if(submit)submit.textContent='Actualizar registro';
  form.scrollIntoView({behavior:'smooth',block:'center'}); toast('Datos cargados en el formulario. Guarda para registrar la actualización.');
}
function downloadFile(filename,content,mime='application/json') {
  const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function createBackup() { downloadFile(`maestropro-respaldo-${todayISO()}.json`,JSON.stringify(db,null,2)); toast('Respaldo descargado.'); }
async function restoreBackup() {
  const input=document.getElementById('restoreFile'); const file=input?.files?.[0]; if(!file){toast('Selecciona primero un archivo JSON.');return;}
  try { const parsed=JSON.parse(await file.text()); const required=['students','groups','attendance','grades','tasks','plans','exams','resources','rubrics','evaluations','events','users','assistant','settings']; if(!required.every(k=>Array.isArray(parsed[k])||k==='settings'&&typeof parsed[k]==='object'))throw new Error('Estructura incompatible'); if(!confirm('La restauración reemplazará los datos actuales. ¿Deseas continuar?'))return; db={...seedData(),...parsed};saveData();toast('Respaldo restaurado.');renderPage(); }
  catch(error){toast('El archivo no es un respaldo válido de MaestroPro.');}
}
function exportGradesCSV() {
  const rows=[['Alumno','Materia','Calificación','Periodo'],...db.grades.map(g=>[studentName(g.studentId),g.subject,g.score,g.period])];
  const csv=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');downloadFile('maestropro-calificaciones.csv','\ufeff'+csv,'text/csv;charset=utf-8');toast('Reporte CSV descargado.');
}

pageContent.addEventListener('submit',event=>{const form=event.target.closest('form');if(!form)return;event.preventDefault();handleSubmit(form);});
document.addEventListener('click',event=>{
  const nav=event.target.closest('[data-page]');if(nav){navigateTo(nav.dataset.page);return;}
  const go=event.target.closest('[data-go]');if(go){navigateTo(go.dataset.go);return;}
  const dateButton=event.target.closest('[data-calendar-date]');if(dateButton){selectedCalendarDate=dateButton.dataset.calendarDate;editingEventId=null;renderPage();const dateInput=document.getElementById('eventDate');if(dateInput)dateInput.value=selectedCalendarDate;return;}
  const action=event.target.closest('[data-action]');if(!action)return;
  const {action:kind,type,id}=action.dataset;
  if(kind==='delete')removeRecord(type,id);
  if(kind==='edit')editRecord(type,id);
  if(kind==='backup')createBackup();
  if(kind==='restore')restoreBackup();
  if(kind==='export-csv')exportGradesCSV();
  if(kind==='prev-month'){calendarMonth--;if(calendarMonth<0){calendarMonth=11;calendarYear--;}renderPage();}
  if(kind==='next-month'){calendarMonth++;if(calendarMonth>11){calendarMonth=0;calendarYear++;}renderPage();}
  if(kind==='go-today'){calendarMonth=new Date().getMonth();calendarYear=new Date().getFullYear();selectedCalendarDate=todayISO();editingEventId=null;renderPage();}
  if(kind==='edit-event'){editingEventId=id;renderPage();}
  if(kind==='delete-event'){if(confirm('¿Deseas eliminar este evento?')){db.events=db.events.filter(e=>e.id!==id);saveData();renderPage();toast('Evento eliminado.');}}
  if(kind==='cancel-event-edit'){editingEventId=null;renderPage();}
});
pageContent.addEventListener('input',event=>{if(event.target.id==='calendarSearch'){calendarSearch=event.target.value;const pos=event.target.selectionStart;renderPage();const input=document.getElementById('calendarSearch');input?.focus();input?.setSelectionRange(pos,pos);}});
pageContent.addEventListener('change',event=>{if(event.target.id==='calendarFilter'){calendarFilter=event.target.value;renderPage();}});
document.querySelectorAll('.nav-link').forEach(btn=>btn.addEventListener('click',()=>navigateTo(btn.dataset.page)));
document.getElementById('menuToggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('currentDate').textContent=new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
renderPage();
