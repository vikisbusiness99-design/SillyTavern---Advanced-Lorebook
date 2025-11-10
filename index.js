/* ============================================================================
   HYBRID DYNAMIC LOREBOOK - SillyTavern Extension
   Reads ST's native lorebook + adds advanced JS logic
   ============================================================================ */


const MODULE_NAME = 'hybrid_dynamic_lorebook';
const DEBUG = false;
const APPLY_LIMIT = 6;
const WINDOW_DEPTH = 2;


globalThis.dynamicLoreInterceptor = async function(chat, contextSize, abort, type) {
    try {
        const context = SillyTavern.getContext();
        const settings = getSettings();
        
        if (!settings.enabled) {
            if (DEBUG) console.log('[DynLore] Extension disabled, skipping');
            return;
        }

        
        const worldInfo = context.worldInfoData;
        if (!worldInfo || !worldInfo.entries) {
            if (DEBUG) console.log('[DynLore] No world info found');
            return;
        }

       
        const chatWindow = buildChatWindow(chat);
        
       
        const engineEntries = convertSTLorebook(worldInfo.entries);
        
        
        const selected = runSelectionEngine(engineEntries, chatWindow, chat.length);
        
      
        injectEntries(chat, selected);
        
        if (DEBUG) console.log('[DynLore] Injected', selected.length, 'entries');
        
    } catch (error) {
        console.error('[DynLore] Interceptor error:', error);
    }
};

/* ============================================================================
   SETTINGS MANAGEMENT
   ============================================================================ */
function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = {
            enabled: true,
            applyLimit: APPLY_LIMIT,
            windowDepth: WINDOW_DEPTH,
            debug: DEBUG
        };
    }
    
    return extensionSettings[MODULE_NAME];
}

/* ============================================================================
   CHAT WINDOW ANALYSIS
   ============================================================================ */
function buildChatWindow(chat) {
    const settings = getSettings();
    const depth = settings.windowDepth || WINDOW_DEPTH;
    
    // Get last N messages
    const recentMessages = chat.slice(-depth);
    const joinedText = recentMessages.map(m => m.mes || '').join(' ');
    
    return {
        text: joinedText,
        normalized: normalizeText(joinedText),
        count: chat.length
    };
}

function normalizeText(text) {
    let s = String(text).toLowerCase();
    s = s.replace(/[^a-z0-9_\s-]/g, ' ');
    s = s.replace(/[-_]+/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return ' ' + s + ' ';
}

/* ============================================================================
   LOREBOOK CONVERSION (ST → Engine Format)
   ============================================================================ */
function convertSTLorebook(stEntries) {
    const entries = [];
    const shifts = {};
    
    for (const entry of stEntries) {
        if (!entry || entry.disable) continue;
        
        // Check if this is a shift entry
        const shiftMatch = entry.comment?.match(/\[SHIFT:([^\]]+)\]/i);
        
        if (shiftMatch) {
            // This is a shift entry
            const parentName = entry.comment.replace(/\[SHIFT:[^\]]+\]/i, '').trim();
            if (!shifts[parentName]) shifts[parentName] = [];
            
            shifts[parentName].push({
                keywords: parseKeywords(entry.key),
                ...parseSecondaryKeys(entry.keysecondary),
                content: entry.content,
                probability: entry.probability ?? 100
            });
        } else {
            // Normal entry
            const parsed = {
                uid: entry.uid,
                title: entry.comment || `Entry ${entry.uid}`,
                keywords: parseKeywords(entry.key),
                ...parseSecondaryKeys(entry.keysecondary),
                content: entry.content,
                probability: entry.probability ?? 100,
                constant: entry.constant || false,
                Shifts: []
            };
            
            entries.push(parsed);
        }
    }
    
    // Attach shifts to parent entries
    for (const entry of entries) {
        if (shifts[entry.title]) {
            entry.Shifts = shifts[entry.title];
        }
    }
    
    return entries;
}

function parseKeywords(keyArray) {
    if (!Array.isArray(keyArray)) return [];
    return keyArray.map(k => String(k).toLowerCase().trim()).filter(Boolean);
}

function parseSecondaryKeys(secondaryArray) {
    // Parse special syntax from secondary keys
    // Format: "priority:5 | trigger:tag1,tag2 | requireAny:word1,word2"
    
    const result = {
        priority: 3,
        triggers: [],
        requireAny: [],
        requireAll: [],
        requireNone: [],
        tag: null
    };
    
    if (!Array.isArray(secondaryArray)) return result;
    
    const joined = secondaryArray.join(' ').toLowerCase();
    const parts = joined.split('|').map(p => p.trim());
    
    for (const part of parts) {
        if (part.startsWith('priority:')) {
            result.priority = parseInt(part.split(':')[1]) || 3;
        }
        else if (part.startsWith('trigger:')) {
            result.triggers = part.split(':')[1].split(',').map(t => t.trim());
        }
        else if (part.startsWith('requireany:')) {
            result.requireAny = part.split(':')[1].split(',').map(t => t.trim());
        }
        else if (part.startsWith('requireall:')) {
            result.requireAll = part.split(':')[1].split(',').map(t => t.trim());
        }
        else if (part.startsWith('requirenone:') || part.startsWith('block:')) {
            result.requireNone = part.split(':')[1].split(',').map(t => t.trim());
        }
        else if (part.startsWith('tag:')) {
            result.tag = part.split(':')[1].trim();
        }
    }
    
    return result;
}

/* ============================================================================
   SELECTION ENGINE (Core Logic)
   ============================================================================ */
function runSelectionEngine(entries, chatWindow, messageCount) {
    const settings = getSettings();
    const limit = settings.applyLimit || APPLY_LIMIT;
    const text = chatWindow.normalized;
    
    
    const buckets = [null, [], [], [], [], []];
    const picked = new Set();
    const triggerTags = new Set();
    
    
    for (const entry of entries) {
        if (entry.constant || hasKeywordMatch(entry.keywords, text)) {
            if (!entryPasses(entry, text, triggerTags)) continue;
            
            const priority = clamp(entry.priority || 3, 1, 5);
            buckets[priority].push(entry);
            picked.add(entry.uid);
            
            // Register triggers
            for (const tag of entry.triggers || []) {
                triggerTags.add(tag);
            }
        }
    }
    
    
    for (const entry of entries) {
        if (picked.has(entry.uid)) continue;
        if (!entry.tag || !triggerTags.has(entry.tag)) continue;
        if (!entryPasses(entry, text, triggerTags)) continue;
        
        const priority = clamp(entry.priority || 3, 1, 5);
        buckets[priority].push(entry);
        picked.add(entry.uid);
        
        for (const tag of entry.triggers || []) {
            triggerTags.add(tag);
        }
    }
    
    
    const selected = [];
    for (let p = 5; p >= 1 && selected.length < limit; p--) {
        for (const entry of buckets[p]) {
            if (selected.length >= limit) break;
            selected.push(entry);
        }
    }
    
    
    const withShifts = [];
    for (const entry of selected) {
        withShifts.push(entry);
        
        if (entry.Shifts && entry.Shifts.length > 0) {
            for (const shift of entry.Shifts) {
                if (hasKeywordMatch(shift.keywords, text) && entryPasses(shift, text, triggerTags)) {
                    withShifts.push({ ...shift, isShift: true, parent: entry.title });
                }
            }
        }
    }
    
    return withShifts;
}

function hasKeywordMatch(keywords, normalizedText) {
    for (const kw of keywords) {
        const term = kw.toLowerCase().trim();
        if (!term) continue;
        
        // Support wildcards: "dragon*" matches "dragon", "dragons", "dragonfly"
        if (term.endsWith('*')) {
            const stem = term.slice(0, -1);
            const regex = new RegExp(`\\b${escapeRegex(stem)}\\w*\\b`, 'i');
            if (regex.test(normalizedText)) return true;
        } else {
            const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
            if (regex.test(normalizedText)) return true;
        }
    }
    return false;
}

function entryPasses(entry, text, triggerTags) {
    
    if (entry.requireAny && entry.requireAny.length > 0) {
        if (!entry.requireAny.some(w => hasKeywordMatch([w], text))) {
            return false;
        }
    }
    
    
    if (entry.requireAll && entry.requireAll.length > 0) {
        if (!entry.requireAll.every(w => hasKeywordMatch([w], text))) {
            return false;
        }
    }
    
    
    if (entry.requireNone && entry.requireNone.length > 0) {
        if (entry.requireNone.some(w => hasKeywordMatch([w], text))) {
            return false;
        }
    }
    
    
    const prob = (entry.probability ?? 100) / 100;
    if (Math.random() > prob) return false;
    
    return true;
}

/* ============================================================================
   INJECTION
   ============================================================================ */
function injectEntries(chat, selected) {
    if (selected.length === 0) return;
    
    
    let compiledText = '\n\n[Dynamic Lorebook Context]\n';
    
    for (const entry of selected) {
        if (entry.isShift) {
            compiledText += `\n[Shift: ${entry.parent}]\n${entry.content}\n`;
        } else {
            compiledText += `\n${entry.content}\n`;
        }
    }
    
   
    const systemMessage = {
        name: 'System',
        is_system: true,
        is_user: false,
        mes: compiledText,
        send_date: Date.now()
    };
    
    
    if (chat.length > 0) {
        chat.splice(chat.length - 1, 0, systemMessage);
    } else {
        chat.push(systemMessage);
    }
}

/* ============================================================================
   UTILITIES
   ============================================================================ */
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ============================================================================
   UI INITIALIZATION
   ============================================================================ */
jQuery(async () => {
    const context = SillyTavern.getContext();
    const settings = getSettings();
    
    
    const toggleButton = $(`
        <div id="dynamic-lorebook-toggle" 
             class="fa-solid fa-book-bookmark" 
             title="Toggle Dynamic Lorebook System"
             style="cursor: pointer; padding: 8px; font-size: 18px;">
        </div>
    `);
    
  
    $('#extensionsMenu').prepend(toggleButton);
    
   
    function updateButtonState() {
        if (settings.enabled) {
            toggleButton.css('color', '#90EE90'); // Green
        } else {
            toggleButton.css('color', '#ff6b6b'); // Red
        }
    }
    
    updateButtonState();
    
   
    toggleButton.on('click', function() {
        settings.enabled = !settings.enabled;
        updateButtonState();
        context.saveSettingsDebounced();
        
        const status = settings.enabled ? 'enabled' : 'disabled';
        toastr.info(`Dynamic Lorebook ${status}`);
    });
    
    
    const settingsHTML = `
        <div id="dynamic-lorebook-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>📚 Hybrid Dynamic Lorebook</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="margin-bot-10px">
                        <small>Advanced lorebook engine that reads ST's native lorebook with enhanced features: cascading triggers, priority bucketing, shifts, and conditional logic.</small>
                    </div>
                    
                    <label class="checkbox_label">
                        <input id="dyn-lore-enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}>
                        <span>Enable Dynamic Lorebook System</span>
                    </label>
                    
                    <div class="margin-bot-10px">
                        <label for="dyn-lore-limit">
                            <small>Entry Limit per Generation</small>
                        </label>
                        <input id="dyn-lore-limit" class="text_pole" type="number" min="1" max="20" value="${settings.applyLimit}" />
                    </div>
                    
                    <div class="margin-bot-10px">
                        <label for="dyn-lore-depth">
                            <small>Message Scan Depth</small>
                        </label>
                        <input id="dyn-lore-depth" class="text_pole" type="number" min="1" max="10" value="${settings.windowDepth}" />
                    </div>
                    
                    <label class="checkbox_label">
                        <input id="dyn-lore-debug" type="checkbox" ${settings.debug ? 'checked' : ''}>
                        <span>Debug Mode (Console Logging)</span>
                    </label>
                    
                    <hr>
                    
                    <div class="margin-bot-10px">
                        <small><b>How to use:</b></small><br>
                        <small>• Create entries in ST's World Info (lorebook)</small><br>
                        <small>• Use Secondary Keys for advanced syntax:</small><br>
                        <small style="font-family: monospace; background: #222; padding: 2px 4px;">priority:5 | trigger:tag1,tag2 | requireAny:word1,word2</small><br>
                        <small>• For shifts, add [SHIFT:trigger] to entry comment</small>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#extensions_settings').append(settingsHTML);
    
    // Settings handlers
    $('#dyn-lore-enabled').on('change', function() {
        settings.enabled = $(this).prop('checked');
        updateButtonState();
        context.saveSettingsDebounced();
    });
    
    $('#dyn-lore-limit').on('input', function() {
        settings.applyLimit = parseInt($(this).val()) || APPLY_LIMIT;
        context.saveSettingsDebounced();
    });
    
    $('#dyn-lore-depth').on('input', function() {
        settings.windowDepth = parseInt($(this).val()) || WINDOW_DEPTH;
        context.saveSettingsDebounced();
    });
    
    $('#dyn-lore-debug').on('change', function() {
        settings.debug = $(this).prop('checked');
        context.saveSettingsDebounced();
    });
    
    console.log('[Dynamic Lorebook] Hybrid system initialized');
});
