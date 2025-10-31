// profile.js
const avatarDrop = document.getElementById('avatarDrop');
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');

const nameField = document.getElementById('nameField');
const bioField = document.getElementById('bioField');
const interestsField = document.getElementById('interestsField');
const tagsPreview = document.getElementById('tagsPreview');
const saveProfile = document.getElementById('saveProfile');
const usrBlockSmall = document.getElementById('usrBlockSmall');

let currentUser = JSON.parse(localStorage.getItem('socially_user')) || {};

// render small usr block
function renderUsrSmall(){
  const u = currentUser;
  if(u && u.name){
    const avatarHtml = u.avatar ? `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%">` : `<div style="width:36px;height:36px;border-radius:50%;background:#eee;display:inline-flex;align-items:center;justify-content:center">${u.name.charAt(0)}</div>`;
    usrBlockSmall.innerHTML = `${avatarHtml} <span style="margin-left:8px">${u.name}</span>`;
  } else {
    usrBlockSmall.innerHTML = `<a href="index.html" class="ghost">Home</a>`;
  }
}

// load existing
function loadProfile(){
  if(currentUser.name) nameField.value = currentUser.name;
  if(currentUser.bio) bioField.value = currentUser.bio;
  if(currentUser.interests) interestsField.value = (currentUser.interests||[]).join(',');
  if(currentUser.avatar){
    avatarPreview.innerHTML = `<img src="${currentUser.avatar}" alt="avatar">`;
  } else {
    avatarPreview.textContent = '+';
  }
  renderTags();
  renderUsrSmall();
}
function renderTags(){
  tagsPreview.innerHTML = '';
  const raw = interestsField.value.trim();
  if(!raw) return;
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  arr.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tag';
    el.textContent = t;
    tagsPreview.appendChild(el);
  });
}

// file handling
avatarDrop.addEventListener('click', ()=> avatarInput.click());
avatarInput.addEventListener('change', (e)=> handleFiles(e.target.files));
avatarDrop.addEventListener('dragover', (e)=> { e.preventDefault(); avatarDrop.style.borderColor = '#ddd'; });
avatarDrop.addEventListener('dragleave', ()=> { avatarDrop.style.borderColor = ''; });
avatarDrop.addEventListener('drop', (e)=> { e.preventDefault(); avatarDrop.style.borderColor = ''; handleFiles(e.dataTransfer.files); });

function handleFiles(files){
  if(!files || !files.length) return;
  const file = files[0];
  if(!file.type.startsWith('image/')) return alert('Yalnız şəkil yükləyə bilərsən.');
  const reader = new FileReader();
  reader.onload = function(ev){
    const data = ev.target.result;
    avatarPreview.innerHTML = `<img src="${data}" alt="avatar">`;
    currentUser.avatar = data;
    renderUsrSmall();
  };
  reader.readAsDataURL(file);
}

// save
saveProfile.addEventListener('click', ()=>{
  const name = nameField.value.trim();
  if(!name) return alert('Ad daxil et.');
  currentUser.name = name;
  currentUser.bio = bioField.value.trim();
  const interests = interestsField.value.split(',').map(s=>s.trim()).filter(Boolean);
  currentUser.interests = interests;
  // persist
  localStorage.setItem('socially_user', JSON.stringify(currentUser));
  alert('Profil yadda saxlandı.');
  renderUsrSmall();
});

// update tags preview live
interestsField.addEventListener('input', renderTags);

// init
loadProfile();
