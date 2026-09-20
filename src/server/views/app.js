const clientSelect = document.getElementById('client-select');
const clientsBody = document.getElementById('clients-body');
const clientForm = document.getElementById('client-form');
const appForm = document.getElementById('app-form');
const generateResult = document.getElementById('generate-result');
const deployButton = document.getElementById('deploy-button');
const deployStatus = document.getElementById('deploy-status');
const deployLog = document.getElementById('deploy-log');

let generated = null; // { clientSlug, appSlug }
let pollTimer = null;

async function loadClients() {
  const res = await fetch('/api/clients');
  const clients = await res.json();

  clientsBody.innerHTML = '';
  clientSelect.innerHTML = '';
  for (const client of clients) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${client.displayName}</td><td>${client.hubspotAccountId}</td>
      <td><button data-slug="${client.portalSlug}" class="remove-client">Remove</button></td>`;
    clientsBody.appendChild(row);

    const option = document.createElement('option');
    option.value = client.portalSlug;
    option.textContent = client.displayName;
    clientSelect.appendChild(option);
  }
}

clientsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('.remove-client');
  if (!button) return;
  await fetch(`/api/clients/${button.dataset.slug}`, { method: 'DELETE' });
  await loadClients();
});

clientForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(clientForm).entries());
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const { error } = await res.json();
    alert(`Failed to add client: ${error}`);
    return;
  }
  clientForm.reset();
  await loadClients();
});

const ACCEPTED_ICON_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp'];
const MAX_ICON_BYTES = 2 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

appForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(appForm);
  const iconFile = formData.get('icon');
  formData.delete('icon');
  const body = Object.fromEntries(formData.entries());

  if (iconFile && iconFile.size > 0) {
    if (!ACCEPTED_ICON_TYPES.includes(iconFile.type)) {
      generateResult.textContent = 'Icon must be PNG, JPEG, GIF, or BMP.';
      return;
    }
    if (iconFile.size > MAX_ICON_BYTES) {
      generateResult.textContent = 'Icon must be 2MB or smaller.';
      return;
    }
    body.icon = await readFileAsDataUrl(iconFile);
  }

  generateResult.textContent = 'Generating…';
  const res = await fetch('/api/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    generateResult.textContent = `Failed: ${data.error}`;
    deployButton.disabled = true;
    return;
  }
  generated = data;
  generateResult.textContent = `Generated at ${data.projectDir}`;
  deployButton.disabled = false;
  deployStatus.textContent = 'Ready to deploy.';
  deployLog.textContent = '';
});

deployButton.addEventListener('click', async () => {
  if (!generated) return;
  deployButton.disabled = true;
  deployStatus.textContent = 'Starting deploy…';
  deployLog.textContent = '';

  const res = await fetch(`/api/apps/${generated.appSlug}/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientSlug: generated.clientSlug })
  });
  const data = await res.json();
  if (!res.ok) {
    deployStatus.textContent = `Failed to start deploy: ${data.error}`;
    deployButton.disabled = false;
    return;
  }

  pollDeploy(data.deployId);
});

function pollDeploy(deployId) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const res = await fetch(`/api/apps/deploys/${deployId}`);
    const deploy = await res.json();
    deployLog.textContent = deploy.log || '';
    deployLog.scrollTop = deployLog.scrollHeight;

    if (deploy.status === 'running') {
      deployStatus.textContent = 'Deploying…';
    } else {
      clearInterval(pollTimer);
      deployStatus.textContent = deploy.status === 'succeeded' ? 'Deploy succeeded.' : 'Deploy failed.';
      deployButton.disabled = false;
    }
  }, 2000);
}

loadClients();
