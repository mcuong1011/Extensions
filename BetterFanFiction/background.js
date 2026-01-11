// Define primary and secondary functions
const MAX_LOGS = 100;
const logError = (type, message, meta = {}) => {
    chrome.storage.local.get('logs')
        .then(({ logs = [] }) => {
            const next = [{ ts: new Date().toISOString(), type, message, meta }, ...logs].slice(0, MAX_LOGS);
            return chrome.storage.local.set({ logs: next });
        })
        .catch((err) => {
            console.error('Failed to write telemetry log:', err);
        });
};
/**
 * Primary feature toggles for the extension.
 * @type {string[]}
 */
const primaryFunctions = [
    'autoSave',
    'markBookmarks',
    'organizer',
    'entireWork',
    'groupDescriptions',
    'styleDescriptions',
    'dateFormat',
];

/**
 * Secondary feature toggles for the extension.
 * @type {string[]}
 */
const secondaryFunctions = [
    'adblock',
    'copy',
    'shortcuts',
    'bookmarks',
    'wordCounter',
    'profileSorts',
    'bigCovers',
    'separateFics'
];

// Default values for primary functions
const primaryDefaults = {
    markBookmarks: true,
    entireWork: true,
    groupDescriptions: true,
    styleDescriptions: true,
    organizer: true,
    dateFormat: "MM/DD/YY"
};

const legacyMap = {
    markFicWithBookmark: 'markBookmarks',
    betterInfo: 'groupDescriptions',
    betterInfoColor: 'styleDescriptions',
    bookmarkButton: 'bookmarks',
    chapterWordCounter: 'wordCounter',
    moreOptionsInProfile: 'profileSorts',
    allowCopy: 'copy',
    allFicButton: 'entireWork',
};

chrome.runtime.onInstalled.addListener((details) => {
    const defaultSettings = {};
    primaryFunctions.forEach(setting => defaultSettings[setting] = primaryDefaults[setting] ?? false);
    secondaryFunctions.forEach(setting => defaultSettings[setting] = true);

    chrome.storage.sync.get('settings')
        .then((result) => {
            const settings = result.settings;
            if (settings) {
                [...primaryFunctions, ...secondaryFunctions].forEach(setting => {
                    if (settings[setting] !== undefined) {
                        defaultSettings[setting] = settings[setting];
                    }
                });
            }

            // compatibility with old version settings
            Object.keys(legacyMap).forEach(oldKey => {
                if (settings && settings[oldKey] !== undefined) {
                    const newKey = legacyMap[oldKey];
                    defaultSettings[newKey] = settings[oldKey];
                }
            });

            return chrome.storage.sync.set({
                settings: defaultSettings
            });
        })
        .catch((error) => {
            console.error('Failed to initialize extension settings during installation:', error);
            logError('storage-error', 'Failed to initialize settings on install', { error: String(error) });
        });

    chrome.storage.local.get()
        .then((result) => Object.keys(result).forEach(id => {
            const addTime = result[id]?.addTime;
            if (typeof addTime === 'string' && addTime.includes('/')) {
                const [d, m, y] = addTime.split('/');
                const parsed = new Date(`${m}/${d}/${y}`);
                if (!Number.isNaN(parsed.getTime())) {
                    result[id].addTime = parsed.toISOString();
                }
            }
        }))
        .catch((error) => {
            console.error('Failed to overwrite legacy date storage during installation:', error);
            logError('storage-error', 'Failed to migrate legacy date storage', { error: String(error) });
        });

    if (details.reason === "install") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("tabs/options/options.html")
        });
    }
});

/**
 * Handles all runtime messages for the extension.
 */
chrome.runtime.onMessage.addListener((action, sender, sendResponse) => {
    if (action.message === 'set-bookmark') {
        chrome.storage.local.set({
            [action.id]: {
                chapter: action.chapter,
                chapters: action.chapters,
                id: action.id,
                fandom: action.fandom,
                author: action.author,
                storyName: action.storyName,
                addTime: action.addTime,
                status: action.status
            },
        })
            .then(() => {
                sendResponse({ result: { success: true } });
            })
            .catch((error) => {
                console.error(`Failed to save bookmark for story ${action.id}:`, error);
                logError('storage-error', 'Failed to save bookmark', { id: action.id, error: String(error) });
                sendResponse({ result: { success: false, error: String(error) } });
            });
    } else if (action.message === 'del-bookmark') {
        chrome.storage.local.remove(action.id)
            .then(() => {
                sendResponse({ result: { success: true } });
            })
            .catch((error) => {
                console.error(`Failed to delete bookmark for story ${action.id}:`, error);
                logError('storage-error', 'Failed to delete bookmark', { id: action.id, error: String(error) });
                sendResponse({ result: { success: false, error: String(error) } });
            });
    } else if (action.message === 'get-info') {
        chrome.storage.sync.get('settings')
            .then((result) => {
                const settings = result.settings;
                sendResponse({ result: settings });
            })
            .catch((error) => {
                console.error('Failed to retrieve extension settings from storage:', error);
                sendResponse({ result: {} });
                logError('storage-error', 'Failed to get settings (get-info)', { error: String(error) });
            });
    } else if (action.message === 'get-dir') {
        chrome.storage.local.get()
            .then((result) => {
                sendResponse({ result });
            })
            .catch((error) => {
                console.error('Failed to retrieve bookmark directory from local storage:', error);
                sendResponse({ result: {} });
                logError('storage-error', 'Failed to get bookmark directory', { error: String(error) });
            });
    }
    else if (action.message === 'set-status') {
        chrome.storage.local.get(action.id)
            .then((data) => {
                const existing = data[action.id] || { id: action.id };
                existing.status = action.status;
                if (!existing.addTime) existing.addTime = new Date().toISOString();
                return chrome.storage.local.set({ [action.id]: existing });
            })
            .then(() => {
                sendResponse({ result: { ok: true } });
            })
            .catch((error) => {
                console.error(`Failed to set status for story ${action.id}:`, error);
                sendResponse({ result: { ok: false } });
                logError('storage-error', 'Failed to set status', { id: action.id, error: String(error) });
            });
    }
    return true;
});

