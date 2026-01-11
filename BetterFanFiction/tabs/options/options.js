// Use the shared checkbox handler
setupCheckboxes();
setupSelects();

const logsContainer = document.querySelector('#logs-container');
const emptyState = () => {
	logsContainer.innerHTML = '<p class="logs-empty">No logs yet.</p>';
};

const renderLogs = (logs = []) => {
	if (!logs.length) return emptyState();
	logsContainer.innerHTML = logs.map(({ ts, type, message, meta }) => {
		const metaString = meta ? JSON.stringify(meta) : '';
		return `<div class="log-entry">
			<div><span class="log-type">[${type}]</span>${message}</div>
			<div class="log-meta">${ts}${metaString ? ' — ' + metaString : ''}</div>
		</div>`;
	}).join('');
};

const loadLogs = () => {
	chrome.storage.local.get('logs')
		.then(({ logs = [] }) => renderLogs(logs))
		.catch(() => emptyState());
};

document.querySelector('#refresh-logs')?.addEventListener('click', loadLogs);
document.querySelector('#clear-logs')?.addEventListener('click', () => {
	chrome.storage.local.remove('logs').then(emptyState);
});

loadLogs();