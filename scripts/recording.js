function buildWaveform(containerId, bars) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  for (let i = 0; i < bars; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    const h = 4 + Math.random() * 20;
    bar.style.height = h + 'px';
    el.appendChild(bar);
  }
}

function startRecording(e) {
  if (e) e.preventDefault();
  isRecording = true;
  isLocked = false;
  document.getElementById('voice-btn').classList.add('recording');
  document.getElementById('recording-bar').classList.add('active');
  document.getElementById('input-bar').style.display = 'none';
  recordingSeconds = 0;
  buildRecWaveform();

  recordingInterval = setInterval(() => {
    recordingSeconds++;
    const m = Math.floor(recordingSeconds / 60);
    const s = recordingSeconds % 60;
    document.getElementById('rec-timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
  }, 1000);
}

function buildRecWaveform() {
  const el = document.getElementById('rec-waveform');
  el.innerHTML = '';

  for (let i = 0; i < 20; i++) {
    const bar = document.createElement('div');
    bar.className = 'rec-wave';
    bar.style.animationDuration = (0.3 + Math.random() * 0.5) + 's';
    bar.style.animationDelay = (Math.random() * 0.3) + 's';
    el.appendChild(bar);
  }
}

function stopRecording() {
  if (!isRecording || isLocked) return;
  finishRecording();
}

function lockRecording() {
  isLocked = true;
  document.getElementById('rec-lock').style.opacity = '0.4';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'send-btn';
  sendBtn.style.cssText = 'position:absolute;right:16px;bottom:20px;';
  sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  sendBtn.onclick = finishRecording;
  document.getElementById('recording-bar').appendChild(sendBtn);
}

function finishRecording() {
  if (!isRecording) return;
  isRecording = false;
  clearInterval(recordingInterval);
  document.getElementById('voice-btn').classList.remove('recording');
  document.getElementById('recording-bar').classList.remove('active');
  const addedBtn = document.querySelector('#recording-bar .send-btn');
  if (addedBtn) addedBtn.remove();
  document.getElementById('input-bar').style.display = 'flex';
  addMessage('', true, true);
}

function cancelRecording() {
  isRecording = false;
  isLocked = false;
  clearInterval(recordingInterval);
  document.getElementById('voice-btn').classList.remove('recording');
  document.getElementById('recording-bar').classList.remove('active');
  document.getElementById('input-bar').style.display = 'flex';
  const addedBtn = document.querySelector('#recording-bar .send-btn');
  if (addedBtn) addedBtn.remove();
}

function playVoice(btn) {
  const waveform = btn.parentElement.querySelector('.voice-waveform');
  if (!waveform) return;
  const bars = waveform.querySelectorAll('.wave-bar');

  if (btn.dataset.playing) {
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    delete btn.dataset.playing;
    bars.forEach(b => b.style.background = 'rgba(255,255,255,0.5)');
    return;
  }

  btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  btn.dataset.playing = '1';

  let i = 0;
  const interval = setInterval(() => {
    bars.forEach(b => b.style.background = 'rgba(255,255,255,0.5)');
    if (i < bars.length) bars[i].style.background = 'white';
    i++;
    if (i >= bars.length) {
      clearInterval(interval);
      btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      delete btn.dataset.playing;
    }
  }, 50);
}
