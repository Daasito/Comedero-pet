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
const celebrationText = document.querySelector('#celebrationText');

// Si web y API se publican juntas, deja esta ruta tal cual.
const API_BASE_URL = '/api/v1';
const DEVICE_ID = 'esp32-001';
let commandPollingTimer;

let currentDuration = Number(portionRange.value);

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

  // Completa visualmente la barra sin necesidad de librerías.
  const percent = ((currentDuration - portionRange.min) / (portionRange.max - portionRange.min)) * 100;
  portionRange.style.background = `linear-gradient(to right, #ee8a42 ${percent}%, #f8d58c ${percent}%)`;
}

/**
 * Envía la duración configurada a la API. El ESP32 tomará el pedido y hará
 * girar el motor durante la cantidad de segundos indicada.
 */
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

function openCelebration() {
  servedAmount.textContent = currentDuration;
  celebration.classList.add('is-visible');
  celebration.setAttribute('aria-hidden', 'false');
  closeCelebration.focus();
}

function closeCelebrationModal() {
  window.clearTimeout(commandPollingTimer);
  celebration.classList.remove('is-visible');
  celebration.setAttribute('aria-hidden', 'true');
  serveButton.focus();
}

function setConnectionStatus(state) {
  connectionStatus.classList.remove('is-online', 'is-offline');
  if (state === 'online' || state === 'busy') {
    connectionStatus.classList.add('is-online');
    connectionStatusText.textContent = 'CONECTADO';
    connectionStatus.setAttribute('aria-label', 'Comedero conectado');
  } else {
    connectionStatus.classList.add('is-offline');
    connectionStatusText.textContent = 'DESCONECTADO';
    connectionStatus.setAttribute('aria-label', 'Comedero desconectado');
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
  try {
    const response = await fetch(`${API_BASE_URL}/commands/${commandId}`);
    if (!response.ok) throw new Error('No se pudo consultar el comando.');
    const command = await response.json();
    if (command.status === 'served') {
      celebrationEyebrow.textContent = '¡ÑAM, ÑAM!';
      celebrationTitle.textContent = '¡Porción servida!';
      celebrationText.innerHTML = `El motor giró durante <span id="servedAmount">${command.duration_seconds}</span> segundos.`;
      servingNote.textContent = `¡Listo! El motor giró ${command.duration_seconds} segundos.`;
      setConnectionStatus('online');
      return;
    }
    if (command.status === 'failed') {
      celebrationEyebrow.textContent = 'UPS…';
      celebrationTitle.textContent = 'No se pudo servir';
      celebrationText.textContent = 'Revisa el comedero e inténtalo nuevamente.';
      servingNote.textContent = 'El comedero reportó un problema.';
      return;
    }
    commandPollingTimer = window.setTimeout(() => checkCommandStatus(commandId), 3000);
  } catch (error) {
    commandPollingTimer = window.setTimeout(() => checkCommandStatus(commandId), 5000);
  }
}

async function serveFood() {
  serveButton.disabled = true;
  serveButton.innerHTML = '<span class="button-icon" aria-hidden="true">…</span> SIRVIENDO...';
  servingNote.textContent = `Preparando el motor durante ${currentDuration} segundos...`;

  try {
    const result = await sendServeCommandToESP32(currentDuration);
    if (!result.ok) throw new Error('El comedero no confirmó el comando.');
    celebrationEyebrow.textContent = 'ORDEN ENVIADA';
    celebrationTitle.textContent = 'Preparando comida...';
    celebrationText.innerHTML = `El motor girará durante <span id="servedAmount">${currentDuration}</span> segundos.`;
    servingNote.textContent = `Orden enviada: esperando al comedero.`;
    openCelebration();
    checkCommandStatus(result.command.id);
  } catch (error) {
    console.error(error);
    servingNote.textContent = 'No pudimos contactar el comedero. Inténtalo nuevamente.';
  } finally {
    serveButton.disabled = false;
    serveButton.innerHTML = '<span class="button-icon" aria-hidden="true">✦</span> SERVIR COMIDA';
  }
}

portionRange.addEventListener('input', updatePortion);
serveButton.addEventListener('click', serveFood);
closeCelebration.addEventListener('click', closeCelebrationModal);
doneButton.addEventListener('click', closeCelebrationModal);
celebration.addEventListener('click', (event) => {
  if (event.target === celebration) closeCelebrationModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && celebration.classList.contains('is-visible')) closeCelebrationModal();
});

updatePortion();
checkDeviceStatus();
window.setInterval(checkDeviceStatus, 15000);
