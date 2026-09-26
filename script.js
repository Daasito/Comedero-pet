// Referencias de Login
const loginScreen = document.querySelector('#loginScreen');
const loginForm = document.querySelector('#loginForm');
const passwordInput = document.querySelector('#passwordInput');
const loginError = document.querySelector('#loginError');
const appShell = document.querySelector('#appShell');
const VALID_PASSWORD = 'Daas1243';

// Referencias del Comedero
const portionRange = document.querySelector('#portionRange');
const portionValue = document.querySelector('#portionValue');
const portionHint = document.querySelector('#portionHint');
const serveButton = document.querySelector('#serveButton');
const servingNote = document.querySelector('#servingNote');
const celebration = document.querySelector('#celebration');
const servedAmount = document.querySelector('#servedAmount');
const closeCelebration = document.querySelector('#closeCelebration');
const doneButton = document.querySelector('#doneButton');
const connectionStatus = document.querySelector('#connectionStatus');
const connectionStatusText = document.querySelector('#connectionStatusText');
const celebrationEyebrow = document.querySelector('#celebrationEyebrow');
const celebrationTitle = document.querySelector('#celebrationTitle');

const API_BASE_URL = 'https://comedero-pet-api.onrender.com/api/v1';
const DEVICE_ID = 'esp32-001';

let commandPollingTimer;
let pollingAttempts = 0;
const MAX_POLLING_ATTEMPTS = 20;
let currentDuration = Number(portionRange.value);
let isServing = false;
let isDeviceOnline = false; // Variable global para rastrear el estado de conexión

// --- 1. LÓGICA DE CONTROL DE ACCESO (LOGIN) ---
function checkAuth() {
  if (sessionStorage.getItem('authenticated') === 'true') {
    if (loginScreen) loginScreen.style.display = 'none';
    if (appShell) appShell.style.display = 'block';
  } else {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appShell) appShell.style.display = 'none';
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passwordInput.value === VALID_PASSWORD) {
      sessionStorage.setItem('authenticated', 'true');
      if (loginError) loginError.style.display = 'none';
      checkAuth();
    } else {
      if (loginError) loginError.style.display = 'block';
      passwordInput.value = '';
    }
  });
}

// --- 2. CONTROL DEL SLIDER Y CONFIGURACIÓN ---
function getDurationDescription(seconds) {
  if (seconds === 0) return 'Motor apagado';
  if (seconds <= 15) return 'Tiempo corto';
  if (seconds <= 40) return 'Tiempo estándar';
  return 'Tiempo largo';
}

function updatePortion() {
  currentDuration = Number(portionRange.value);
  portionValue.textContent = currentDuration;
  portionHint.textContent = getDurationDescription(currentDuration);

  const percent = ((currentDuration - portionRange.min) / (portionRange.max - portionRange.min)) * 100;
  portionRange.style.background = `linear-gradient(to right, #ee8a42 ${percent}%, #f8d58c ${percent}%)`;
}

// --- 3. LÓGICA DEL MODAL Y BLOQUEO AL SERVIR ---
function openCelebration() {
  isServing = true;
  servedAmount.textContent = currentDuration;
  celebration.classList.add('is-visible');
  celebration.setAttribute('aria-hidden', 'false');
  
  closeCelebration.style.display = 'none';
  doneButton.style.display = 'none';
}

function unlockCelebrationModal() {
  isServing = false;
  closeCelebration.style.display = 'block';
  doneButton.style.display = 'inline-block';
  closeCelebration.focus();
}

function closeCelebrationModal() {
  if (isServing) return;

  window.clearTimeout(commandPollingTimer);
  celebration.classList.remove('is-visible');
  celebration.setAttribute('aria-hidden', 'true');
  
  // Reactivar botón solo si el dispositivo está en línea
  serveButton.innerHTML = '<span class="button-icon" aria-hidden="true">✦</span> SERVIR COMIDA';
  
  if (isDeviceOnline) {
    serveButton.disabled = false;
    servingNote.textContent = 'Listo para servir.';
    serveButton.focus();
  } else {
    serveButton.disabled = true;
    servingNote.textContent = 'Comedero desconectado. Revisa la conexión.';
  }
}

// --- 4. COMUNICACIÓN CON LA API FASTAPI ---
async function sendServeCommandToESP32(durationSeconds) {
  const response = await fetch(`${API_BASE_URL}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: DEVICE_ID, duration_seconds: durationSeconds }),
  });
  
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail || 'No se pudo crear el comando.');
  }
  return { ok: true, command: await response.json() };
}

function setConnectionStatus(state) {
  connectionStatus.classList.remove('is-online', 'is-offline');
  
  if (state === 'online' || state === 'busy') {
    isDeviceOnline = true;
    connectionStatus.classList.add('is-online');
    connectionStatusText.textContent = 'CONECTADO';
    connectionStatus.setAttribute('aria-label', 'Comedero conectado');
    
    // Si no se está ejecutando un proceso activo, habilitar el botón
    if (!isServing) {
      serveButton.disabled = false;
      servingNote.textContent = 'Listo para servir.';
    }
  } else {
    isDeviceOnline = false;
    connectionStatus.classList.add('is-offline');
    connectionStatusText.textContent = 'DESCONECTADO';
    connectionStatus.setAttribute('aria-label', 'Comedero desconectado');
    
    // Deshabilitar el botón inmediatamente si está fuera de línea
    if (!isServing) {
      serveButton.disabled = true;
      servingNote.textContent = 'Comedero desconectado. Revisa la conexión.';
    }
  }
}

async function checkDeviceStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/devices/${DEVICE_ID}/status`);
    if (!response.ok) throw new Error('No se pudo consultar el estado.');
    const device = await response.json();
    setConnectionStatus(device.status);
  } catch (error) {
    setConnectionStatus('offline');
  }
}

async function checkCommandStatus(commandId) {
  if (pollingAttempts >= MAX_POLLING_ATTEMPTS) {
    celebrationEyebrow.textContent = 'TIEMPO AGOTADO';
    celebrationTitle.textContent = 'Sin respuesta del comedero';
    servingNote.textContent = 'El comedero tardó demasiado en responder.';
    unlockCelebrationModal();
    return;
  }

  try {
    pollingAttempts++;
    const response = await fetch(`${API_BASE_URL}/commands/${commandId}`);
    if (!response.ok) throw new Error('No se pudo consultar el comando.');
    
    const command = await response.json();
    
    if (command.status === 'served') {
      celebrationEyebrow.textContent = '¡ÑAM, ÑAM!';
      celebrationTitle.textContent = '¡Porción servida!';
      servedAmount.textContent = command.duration_seconds;
      servingNote.textContent = `¡Listo! El motor giró ${command.duration_seconds} segundos.`;
      setConnectionStatus('online');
      unlockCelebrationModal();
      return;
    }
    
    if (command.status === 'failed') {
      celebrationEyebrow.textContent = 'UPS…';
      celebrationTitle.textContent = 'No se pudo servir';
      servingNote.textContent = 'El comedero reportó un problema.';
      unlockCelebrationModal();
      return;
    }
    
    commandPollingTimer = window.setTimeout(() => checkCommandStatus(commandId), 3000);
  } catch (error) {
    commandPollingTimer = window.setTimeout(() => checkCommandStatus(commandId), 5000);
  }
}

async function serveFood() {
  if (!isDeviceOnline) {
    servingNote.textContent = 'El comedero está desconectado.';
    return;
  }

  serveButton.disabled = true;
  serveButton.innerHTML = '<span class="button-icon" aria-hidden="true">…</span> SIRVIENDO...';
  servingNote.textContent = `Preparando el motor durante ${currentDuration} segundos...`;

  try {
    const result = await sendServeCommandToESP32(currentDuration);
    if (!result.ok) throw new Error('El comedero no confirmó el comando.');
    
    celebrationEyebrow.textContent = 'PROCESANDO...';
    celebrationTitle.textContent = 'Serviendo comida...';
    openCelebration();
    
    pollingAttempts = 0;
    checkCommandStatus(result.command.id);
  } catch (error) {
    console.error(error);
    servingNote.textContent = 'No pudimos contactar el comedero. Inténtalo nuevamente.';
    serveButton.disabled = false;
    serveButton.innerHTML = '<span class="button-icon" aria-hidden="true">✦</span> SERVIR COMIDA';
  }
}

// --- 5. EVENT LISTENERS Y PROTECCIÓN ---
portionRange.addEventListener('input', updatePortion);
serveButton.addEventListener('click', serveFood);
closeCelebration.addEventListener('click', closeCelebrationModal);
doneButton.addEventListener('click', closeCelebrationModal);

celebration.addEventListener('click', (event) => {
  if (!isServing && event.target === celebration) {
    closeCelebrationModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (!isServing && event.key === 'Escape' && celebration.classList.contains('is-visible')) {
    closeCelebrationModal();
  }
});

// Inicialización
checkAuth();
updatePortion();
checkDeviceStatus();
window.setInterval(checkDeviceStatus, 15000);